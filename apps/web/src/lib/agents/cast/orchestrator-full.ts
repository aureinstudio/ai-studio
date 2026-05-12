import type { SupabaseClient } from "@supabase/supabase-js";
import { SlideAnalyzer, type SlideInputMeta, type SlideAnalyzerOutput } from "./slide-analyzer";
import { ScriptWriter, type ScriptWriterOutput } from "./script-writer";
import { runCastTTS, type TTSResult } from "./tts";
import { runCastAvatarVideo, submitHeyGenVideo, type VideoResult, type VoiceScene, type VoiceSource } from "./avatar-video";
import { runCastCaptionsChapters, type CaptionsResult } from "./captions-chapters";
import { QualityChecker, type QualityCheckerOutput } from "./quality-checker";
import { Agent, AgentError, type AgentLog } from "../base";
import { logCost } from "@/lib/cost-tracker";

export type CastFullResult = {
  analysis: SlideAnalyzerOutput;
  scripts: ScriptWriterOutput;
  quality: QualityCheckerOutput | null;
  retry_count: number;
  tts: TTSResult;
  video: VideoResult;
  captions: CaptionsResult;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Cast 전체 체인 (v0.15.0) — TEAM 1 + TEAM 2.
 *
 * 흐름:
 *   #01 SlideAnalyzer  (LLM, Claude)
 *     ↓
 *   #02 ScriptWriter   (LLM, Claude)
 *     ↓
 *   #03 TTS            (외부 API, ElevenLabs)
 *     ↓
 *   #04 AvatarVideo    (외부 API, HeyGen multi-scene)
 *     ↓
 *   #05 Captions       (포매팅, 외부 API 없음)
 *
 * 비용 합산:
 *   - LLM (cast service): ~$0.05~0.15
 *   - TTS (elevenlabs):   ~$0.30~1.50 (글자 수 기반)
 *   - Video (heygen):     ~$2.00~5.00 (영상 길이 기반)
 *   - 총: ~$3~7 / 회 (5-10 슬라이드 기준)
 */
export async function runCastFullChain(
  supabase: SupabaseClient,
  castJobId: string,
  userId: string,
  topic: string,
  slides: SlideInputMeta[],
  isCertification: boolean,
  model?: string,
  avatarId?: string,
  voiceSource: VoiceSource = "heygen",
  voiceId?: string,
  webhookUrl?: string,
): Promise<CastFullResult> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];
  let chainStep = 0;

  const persistLogs = async () => {
    await supabase.from("cast_jobs").update({ agent_logs }).eq("id", castJobId);
  };

  const persistJobField = async (updates: Record<string, unknown>) => {
    await supabase.from("cast_jobs").update(updates).eq("id", castJobId);
  };

  // LLM 에이전트용 (#01, #02) - Studio와 동일 패턴
  const runLLM = async <I, O>(
    agent: Agent<I, O>,
    input: I,
  ): Promise<{ output: O; log: AgentLog }> => {
    const startedAt = new Date().toISOString();
    const startedLog: AgentLog = {
      agent_id: agent.id,
      agent_name: agent.name,
      status: "started",
      started_at: startedAt,
      completed_at: startedAt,
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
    };
    agent_logs.push(startedLog);
    await persistLogs();

    try {
      const result = await agent.execute(input, {
        onProgress: async (tokensOut) => {
          startedLog.tokens_out = tokensOut;
          await persistLogs();
        },
      });
      const idx = agent_logs.indexOf(startedLog);
      if (idx >= 0) agent_logs[idx] = result.log;
      await persistLogs();

      chainStep++;
      await logCost({
        supabase,
        service: "cast",
        endpoint: "/api/cast/generate",
        userId,
        tokensIn: result.log.tokens_in,
        tokensOut: result.log.tokens_out,
        costUsd: result.log.cost_usd,
        metadata: { agent_id: agent.id, cast_job_id: castJobId, chain_step: chainStep },
      });
      return result;
    } catch (err) {
      const idx = agent_logs.indexOf(startedLog);
      if (idx >= 0 && err instanceof AgentError && err.partialLog) {
        agent_logs[idx] = err.partialLog;
      } else if (idx >= 0) {
        agent_logs[idx] = { ...startedLog, status: "failed", error: String(err) };
      }
      await persistLogs();
      throw err;
    }
  };

  // 외부 API 에이전트용 (#03, #04, #05) - started 로그 → 결과 로그 교체
  const pushStartedLog = async (agentId: string, agentName: string): Promise<AgentLog> => {
    const startedAt = new Date().toISOString();
    const log: AgentLog = {
      agent_id: agentId,
      agent_name: agentName,
      status: "started",
      started_at: startedAt,
      completed_at: startedAt,
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
    };
    agent_logs.push(log);
    await persistLogs();
    return log;
  };

  const replaceLog = async (startedLog: AgentLog, finalLog: AgentLog) => {
    const idx = agent_logs.indexOf(startedLog);
    if (idx >= 0) agent_logs[idx] = finalLog;
    await persistLogs();
  };

  await persistJobField({ status: "running", agent_logs: [] });

  try {
    // ─── #01 SlideAnalyzer ──────────────────────────
    const r01 = await runLLM(new SlideAnalyzer(model), {
      topic,
      slides,
      is_certification: isCertification,
    });

    // ─── #02 ScriptWriter ───────────────────────────
    let r02 = await runLLM(new ScriptWriter(model), {
      topic,
      slides,
      analysis: r01.output,
      is_certification: isCertification,
    });

    // ─── #07 QualityChecker (스크립트 사전 검증) + 자동 재시도 ─────
    // HeyGen 비용 발생 전 스크립트 품질 검증. fail 시 ScriptWriter 1회 재시도.
    let quality: QualityCheckerOutput | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 1;

    const runQualityCheck = async () => {
      return await runLLM(new QualityChecker(model), {
        topic,
        scripts: r02.output.scripts,
        expected_duration_seconds: r01.output.total_estimated_duration,
      });
    };

    try {
      const qc = await runQualityCheck();
      quality = qc.output;

      if (!quality.overall_pass && quality.regenerate_recommended && retryCount < MAX_RETRIES) {
        // 재생성 — ScriptWriter 다시 실행 (이슈 피드백 포함)
        retryCount++;
        console.warn(
          `[cast-07] quality fail (n=${quality.naturalness_score}/p=${quality.pacing_score}/c=${quality.clarity_score}). Issues: ${quality.issues.join("; ")}. Retrying ScriptWriter...`,
        );
        await persistJobField({ retry_count: retryCount });
        r02 = await runLLM(new ScriptWriter(model), {
          topic,
          slides,
          analysis: r01.output,
          is_certification: isCertification,
        });
        // 재검증
        const qc2 = await runQualityCheck();
        quality = qc2.output;
      }

      // 품질 정보 DB 저장
      await persistJobField({ quality_score: quality, retry_count: retryCount });
    } catch (err) {
      // QualityChecker 자체 실패는 fail-soft — 검증 없이 진행
      console.warn("[cast-07] quality check failed (fail-soft, continuing):", err);
    }

    // ─── #03 TTS (조건부) ────────────────────────────
    // voiceSource='heygen': TTS 스킵, HeyGen이 자체 TTS로 영상 생성
    // voiceSource='elevenlabs': ElevenLabs로 mp3 생성 후 HeyGen에 audio_url 전달
    let tts: { result: TTSResult; log: AgentLog };
    if (voiceSource === "heygen") {
      const now = new Date().toISOString();
      const skipLog: AgentLog = {
        agent_id: "cast-03",
        agent_name: "TTS 음성 생성",
        status: "skipped",
        started_at: now,
        completed_at: now,
        duration_ms: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        error: "HeyGen 자체 TTS 사용 (ElevenLabs 미사용)",
      };
      agent_logs.push(skipLog);
      await persistLogs();
      tts = {
        result: { audio_files: [], total_cost_usd: 0, total_chars: 0 },
        log: skipLog,
      };
    } else {
      const ttsStarted = await pushStartedLog("cast-03", "TTS 음성 생성");
      tts = await runCastTTS(
        supabase,
        castJobId,
        userId,
        r02.output.scripts,
        async (current, total, currentCost) => {
          ttsStarted.tokens_out = current;
          ttsStarted.cost_usd = currentCost;
          await persistLogs();
          await persistJobField({ cost_usd: currentCost });
        },
      );
      await replaceLog(ttsStarted, tts.log);
      if (tts.log.status === "failed") {
        console.warn("[cast-03] failed, continuing without audio (scripts + captions only):", tts.log.error);
      }
    }

    // ─── #04 AvatarVideo (HeyGen) ───────────────────
    // voiceSource='heygen': 스크립트 텍스트 → HeyGen TTS로 영상 생성 (audio_url 없음)
    // voiceSource='elevenlabs': audio_files → audio_url로 영상 생성
    let video: { result: { video_url: string; video_path: string | null; duration_sec: number; cost_usd: number; heygen_video_id: string }; log: AgentLog };

    // scene 빌드 — 모드에 따라 다른 입력
    const scenes: VoiceScene[] = voiceSource === "heygen"
      ? r02.output.scripts.map((s) => ({ slide_number: s.slide_number, text: s.script_text }))
      : tts.result.audio_files.map((a) => ({ slide_number: a.slide_number, audio_url: a.audio_url }));

    if (scenes.length === 0) {
      const now = new Date().toISOString();
      const skipLog: AgentLog = {
        agent_id: "cast-04",
        agent_name: "아바타 영상 합성",
        status: "skipped",
        started_at: now,
        completed_at: now,
        duration_ms: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        error: voiceSource === "heygen" ? "스크립트가 없어 영상 생성 스킵" : "TTS 음성이 없어 영상 생성 스킵",
      };
      agent_logs.push(skipLog);
      await persistLogs();
      video = {
        result: { video_url: "", video_path: null, duration_sec: 0, cost_usd: 0, heygen_video_id: "" },
        log: skipLog,
      };
    } else {
      // ⚡ webhook 비동기 모드 — HeyGen에 제출만 (3~5초)
      // 폴링 없음, Vercel timeout 무관. webhook이 완료 알림.
      const videoStarted = await pushStartedLog("cast-04", "아바타 영상 합성");
      try {
        const { video_id } = await submitHeyGenVideo(
          scenes,
          topic,
          castJobId,
          avatarId,
          voiceId,
          webhookUrl,
        );
        // 비용은 webhook 완료 시 계산 (영상 길이 알면). 우선 0으로 기록.
        const submittedLog: AgentLog = {
          agent_id: "cast-04",
          agent_name: "아바타 영상 합성",
          status: "started", // UI에서 펄스 — 렌더링 중 표시
          started_at: videoStarted.started_at,
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
          error: `HeyGen 제출됨 (video_id: ${video_id.slice(0, 8)}…) — webhook 대기 중`,
        };
        await replaceLog(videoStarted, submittedLog);
        // cast_jobs에 heygen_video_id 저장 (webhook이 이걸로 매칭)
        await persistJobField({ heygen_video_id: video_id });
        video = {
          result: {
            video_url: "",
            video_path: null,
            duration_sec: 0,
            cost_usd: 0,
            heygen_video_id: video_id,
          },
          log: submittedLog,
        };
      } catch (err) {
        const failedLog: AgentLog = {
          agent_id: "cast-04",
          agent_name: "아바타 영상 합성",
          status: "failed",
          started_at: videoStarted.started_at,
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        await replaceLog(videoStarted, failedLog);
        video = {
          result: { video_url: "", video_path: null, duration_sec: 0, cost_usd: 0, heygen_video_id: "" },
          log: failedLog,
        };
        console.warn("[cast-04] submit failed:", err);
      }
    }

    // ─── #05 Captions·Chapters ──────────────────────
    const capStarted = await pushStartedLog("cast-05", "자막·챕터 생성");
    const captions = await runCastCaptionsChapters(
      supabase,
      castJobId,
      r02.output.scripts,
      tts.result.audio_files,
      topic,
    );
    await replaceLog(capStarted, captions.log);

    // ─── 최종 저장 ──────────────────────────────────
    const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
    const totalDurationMs = Date.now() - overallStart;

    const output = {
      analysis: r01.output,
      scripts: r02.output,
      tts: tts.result,
      video: video.result,
      captions: captions.result,
    };

    // 영상이 아직 렌더링 중 (heygen_video_id 있고 video_url 없음) → status='rendering'
    // webhook이 완료되면 'completed'로 자동 갱신
    const isRendering =
      !!video.result.heygen_video_id && !video.result.video_url;
    const finalStatus = isRendering ? "rendering" : "completed";

    await persistJobField({
      status: finalStatus,
      output,
      cost_usd: totalCost,
      duration_seconds: totalDurationMs / 1000,
      video_url: video.result.video_url || null,
      captions_url: captions.result.srt_url || null,
      completed_at: isRendering ? null : new Date().toISOString(),
    });

    return {
      analysis: r01.output,
      scripts: r02.output,
      quality,
      retry_count: retryCount,
      tts: tts.result,
      video: video.result,
      captions: captions.result,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persistJobField({
      status: "failed",
      error_message: message,
      duration_seconds: (Date.now() - overallStart) / 1000,
    });
    throw err;
  }
}
