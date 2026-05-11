import type { SupabaseClient } from "@supabase/supabase-js";
import { SlideAnalyzer, type SlideInputMeta, type SlideAnalyzerOutput } from "./slide-analyzer";
import { ScriptWriter, type ScriptWriterOutput } from "./script-writer";
import { runCastTTS, type TTSResult } from "./tts";
import { runCastAvatarVideo, type VideoResult } from "./avatar-video";
import { runCastCaptionsChapters, type CaptionsResult } from "./captions-chapters";
import { Agent, AgentError, type AgentLog } from "../base";
import { logCost } from "@/lib/cost-tracker";

export type CastFullResult = {
  analysis: SlideAnalyzerOutput;
  scripts: ScriptWriterOutput;
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
    const r02 = await runLLM(new ScriptWriter(model), {
      topic,
      slides,
      analysis: r01.output,
      is_certification: isCertification,
    });

    // ─── #03 TTS (ElevenLabs) ───────────────────────
    const ttsStarted = await pushStartedLog("cast-03", "TTS 음성 생성");
    const tts = await runCastTTS(
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
    if (tts.log.status === "failed") throw new Error(tts.log.error ?? "TTS failed");

    // ─── #04 AvatarVideo (HeyGen) ───────────────────
    const videoStarted = await pushStartedLog("cast-04", "아바타 영상 합성");
    const video = await runCastAvatarVideo(
      supabase,
      castJobId,
      userId,
      tts.result.audio_files,
      topic,
      async (status, elapsedSec) => {
        videoStarted.error = `${status} (${elapsedSec}s 경과)`;
        await persistLogs();
      },
    );
    // 진행 상태 메시지는 완료 시 정리
    videoStarted.error = undefined;
    await replaceLog(videoStarted, video.log);
    if (video.log.status === "failed") {
      // 영상 실패는 fail-soft: 자막은 계속 생성
      console.warn("[cast-04] failed, continuing with captions only:", video.log.error);
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

    await persistJobField({
      status: "completed",
      output,
      cost_usd: totalCost,
      duration_seconds: totalDurationMs / 1000,
      video_url: video.result.video_url || null,
      captions_url: captions.result.srt_url || null,
      completed_at: new Date().toISOString(),
    });

    return {
      analysis: r01.output,
      scripts: r02.output,
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
