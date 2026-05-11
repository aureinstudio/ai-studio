import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateVideoCost } from "@/lib/external/heygen";
import { logCost } from "@/lib/cost-tracker";
import type { AudioFile } from "./tts";
import type { AgentLog } from "../base";

const HEYGEN_API_BASE = "https://api.heygen.com";
// 기본 fallback (호출 시 avatar_id 미제공 시). 동양인 검증 필요.
const DEFAULT_AVATAR_ID = "Anna_public_3_20240108";

// HeyGen 자체 TTS용 한국어 voice. 본부장이 HeyGen voices에서 동양인·한국어 voice 검증 권장.
// /v2/voices 또는 대시보드에서 다른 voice_id로 교체 가능.
const DEFAULT_KOREAN_VOICE_ID = "1bd001e7e50f421d891986aad5158bc8";

export type VoiceSource = "elevenlabs" | "heygen";

export type VoiceScene = {
  slide_number: number;
  // ElevenLabs 모드 — 미리 생성된 음성 URL
  audio_url?: string;
  // HeyGen 모드 — 텍스트를 HeyGen TTS로 변환
  text?: string;
};
const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 80; // 80 × 15s = 20분 최대

export type VideoResult = {
  video_url: string;
  video_path: string | null; // Supabase Storage 미러 (선택)
  duration_sec: number;
  cost_usd: number;
  heygen_video_id: string;
};

/**
 * Cast Agent #04 — 아바타 영상 합성.
 *
 * HeyGen v2 multi-scene 영상 생성:
 * - 각 슬라이드의 음성 URL → 별도 scene
 * - 전체 scene을 단일 영상으로 자동 concat (ffmpeg 불필요)
 * - 폴링으로 완료 대기 (5~15분 소요)
 *
 * ⚠️ 현재 베타: avatar speaking only — 슬라이드 이미지 미표시.
 * 슬라이드 시각화는 Phase 2 (별도 슬라이드 렌더링 인프라 필요).
 */
export async function runCastAvatarVideo(
  supabase: SupabaseClient,
  castJobId: string,
  userId: string,
  scenes: VoiceScene[],
  topic: string,
  avatarId: string = DEFAULT_AVATAR_ID,
  voiceId: string = DEFAULT_KOREAN_VOICE_ID,
  onProgressUpdate?: (status: string, elapsedSec: number) => Promise<void>,
): Promise<{ result: VideoResult; log: AgentLog }> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    const log: AgentLog = {
      agent_id: "cast-04",
      agent_name: "아바타 영상 합성",
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: "HEYGEN_API_KEY not configured",
    };
    return {
      result: {
        video_url: "",
        video_path: null,
        duration_sec: 0,
        cost_usd: 0,
        heygen_video_id: "",
      },
      log,
    };
  }

  try {
    // avatar_id 형식 감지:
    // - 32자 hex UUID → talking_photo (사용자 업로드·custom avatar)
    // - 그 외 (예: Anna_public_3_20240108) → 공개 avatar
    const isTalkingPhoto = /^[a-f0-9]{32}$/i.test(avatarId);
    const character = isTalkingPhoto
      ? {
          type: "talking_photo" as const,
          talking_photo_id: avatarId,
        }
      : {
          type: "avatar" as const,
          avatar_id: avatarId,
          avatar_style: "normal" as const,
        };

    // 1. video_inputs — 슬라이드별 scene 빌드
    // ElevenLabs 모드: audio_url 사용 / HeyGen 모드: input_text + voice_id 사용
    const video_inputs = scenes
      .sort((a, b) => a.slide_number - b.slide_number)
      .map((scene) => ({
        character,
        voice: scene.audio_url
          ? ({ type: "audio" as const, audio_url: scene.audio_url })
          : ({ type: "text" as const, input_text: scene.text ?? "", voice_id: voiceId }),
      }));

    // 2. POST /v2/video/generate
    const startRes = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs,
        dimension: { width: 1920, height: 1080 },
        title: `KEG Cast · ${topic} · ${castJobId.slice(0, 8)}`,
      }),
    });

    if (!startRes.ok) {
      const txt = await startRes.text().catch(() => "");
      throw new Error(`HeyGen generate ${startRes.status}: ${txt.slice(0, 500)}`);
    }

    const startData = (await startRes.json()) as { data: { video_id: string } };
    const videoId = startData.data.video_id;

    if (onProgressUpdate) {
      await onProgressUpdate(`HeyGen 영상 ID ${videoId.slice(0, 8)} — 렌더링 시작`, 0);
    }

    // 3. 폴링
    let videoUrl: string | undefined;
    let durationSec = 0;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const elapsed = Math.floor((Date.now() - startMs) / 1000);

      const statusRes = await fetch(
        `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
        { headers: { "X-Api-Key": apiKey } },
      );
      if (!statusRes.ok) {
        if (onProgressUpdate) await onProgressUpdate(`상태 조회 일시 오류 (재시도)`, elapsed);
        continue;
      }
      const statusJson = (await statusRes.json()) as {
        data: {
          status: string;
          video_url?: string;
          duration?: number;
          error?: { message?: string };
        };
      };
      const status = statusJson.data.status;

      if (status === "completed") {
        videoUrl = statusJson.data.video_url;
        durationSec = statusJson.data.duration ?? 0;
        if (onProgressUpdate) await onProgressUpdate(`✓ 렌더링 완료 (${durationSec}s)`, elapsed);
        break;
      }
      if (status === "failed") {
        throw new Error(`HeyGen failed: ${statusJson.data.error?.message ?? "unknown"}`);
      }
      if (onProgressUpdate) {
        await onProgressUpdate(`렌더링 중… (${status})`, elapsed);
      }
    }

    if (!videoUrl) {
      throw new Error(`HeyGen polling timeout after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
    }

    const costUsd = calculateVideoCost(durationSec);

    // 4. cost_log — service='heygen' 별도 기록
    await logCost({
      supabase,
      service: "heygen",
      endpoint: "/v2/video/generate",
      userId,
      tokensIn: 0,
      tokensOut: 0,
      costUsd,
      metadata: { cast_job_id: castJobId, heygen_video_id: videoId, duration_sec: durationSec },
    });

    const completedAt = new Date().toISOString();
    const log: AgentLog = {
      agent_id: "cast-04",
      agent_name: "아바타 영상 합성",
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: durationSec,
      cost_usd: costUsd,
    };

    return {
      result: {
        video_url: videoUrl,
        video_path: null, // HeyGen URL 직접 사용 (Supabase 미러는 별도)
        duration_sec: durationSec,
        cost_usd: costUsd,
        heygen_video_id: videoId,
      },
      log,
    };
  } catch (err) {
    const log: AgentLog = {
      agent_id: "cast-04",
      agent_name: "아바타 영상 합성",
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: err instanceof Error ? err.message : String(err),
    };
    return {
      result: { video_url: "", video_path: null, duration_sec: 0, cost_usd: 0, heygen_video_id: "" },
      log,
    };
  }
}
