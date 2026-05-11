import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSpeech, calculateTtsCost } from "@/lib/external/elevenlabs";
import { uploadToStorage } from "@/lib/storage";
import { logCost } from "@/lib/cost-tracker";
import type { ScriptEntry } from "./script-writer";
import type { AgentLog } from "../base";

export type AudioFile = {
  slide_number: number;
  audio_url: string;
  audio_path: string;
  duration_estimate_sec: number;
  char_count: number;
  cost_usd: number;
};

export type TTSResult = {
  audio_files: AudioFile[];
  total_cost_usd: number;
  total_chars: number;
};

/**
 * Cast Agent #03 — TTS (음성 생성).
 *
 * 슬라이드별 스크립트 → ElevenLabs API → mp3 → Supabase Storage 업로드.
 * 순차 처리 (병렬 시 ElevenLabs Tier 1 rate limit 위험).
 *
 * LLM 아닌 외부 API 호출 → Agent 클래스 미상속, plain async function.
 */
export async function runCastTTS(
  supabase: SupabaseClient,
  castJobId: string,
  userId: string,
  scripts: ScriptEntry[],
  onSlideProgress?: (current: number, total: number, currentCost: number) => Promise<void>,
): Promise<{ result: TTSResult; log: AgentLog }> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const audio_files: AudioFile[] = [];
  let total_cost_usd = 0;
  let total_chars = 0;

  try {
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const tts = await generateSpeech(script.script_text);

      const path = `${castJobId}/slide-${String(script.slide_number).padStart(2, "0")}.mp3`;
      const { url, path: storedPath } = await uploadToStorage(
        supabase,
        "cast-audio",
        path,
        tts.audioBuffer,
        "audio/mpeg",
      );

      // 한국어 발화 ~15자/초 가정
      const duration_estimate_sec = Math.max(3, Math.ceil(script.script_text.length / 15));

      const af: AudioFile = {
        slide_number: script.slide_number,
        audio_url: url,
        audio_path: storedPath,
        duration_estimate_sec,
        char_count: tts.characterCount,
        cost_usd: tts.costUsd,
      };
      audio_files.push(af);
      total_cost_usd += tts.costUsd;
      total_chars += tts.characterCount;

      // cost_log — service='elevenlabs' 분리 기록
      await logCost({
        supabase,
        service: "elevenlabs",
        endpoint: "/text-to-speech",
        userId,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: tts.costUsd,
        metadata: { cast_job_id: castJobId, slide_number: script.slide_number, chars: tts.characterCount },
      });

      if (onSlideProgress) {
        await onSlideProgress(i + 1, scripts.length, total_cost_usd);
      }
    }

    const completedAt = new Date().toISOString();
    const log: AgentLog = {
      agent_id: "cast-03",
      agent_name: "TTS 음성 생성",
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: total_chars, // chars as proxy
      cost_usd: total_cost_usd,
    };

    return {
      result: { audio_files, total_cost_usd, total_chars },
      log,
    };
  } catch (err) {
    const log: AgentLog = {
      agent_id: "cast-03",
      agent_name: "TTS 음성 생성",
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startMs,
      tokens_in: 0,
      tokens_out: total_chars,
      cost_usd: total_cost_usd,
      error: err instanceof Error ? err.message : String(err),
    };
    return { result: { audio_files, total_cost_usd, total_chars }, log };
  }
}

export { calculateTtsCost };
