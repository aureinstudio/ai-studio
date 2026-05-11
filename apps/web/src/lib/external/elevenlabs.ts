/**
 * ElevenLabs TTS 클라이언트 (fetch 기반).
 * 공식 SDK(@elevenlabs/elevenlabs-js) 대신 fetch 직접 사용 — 의존성 최소화.
 *
 * ⚠️ 서버 전용. ELEVENLABS_API_KEY는 NEXT_PUBLIC_ 접두사 *없음*.
 *
 * 가격 (2026-05 기준 추정): ~$0.30 / 1000자
 * Cast TEAM 2 (다음 단계)에서 사용 — 현재는 스캐폴딩만.
 */

const API_BASE = "https://api.elevenlabs.io/v1";

export type GenerateSpeechOptions = {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
};

export type GenerateSpeechResult = {
  audioBuffer: ArrayBuffer;
  characterCount: number;
  costUsd: number;
};

/**
 * 텍스트 → 음성 변환.
 * 응답은 mp3 ArrayBuffer. Supabase Storage 등에 업로드 후 URL 사용.
 *
 * @param text TTS 변환 대상 텍스트 (한국어)
 * @param voiceId ElevenLabs voice ID (기본: 다국어 voice)
 * @param options stability / similarity 등 음성 파라미터
 */
export async function generateSpeech(
  text: string,
  options: GenerateSpeechOptions = {},
): Promise<GenerateSpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const voiceId = options.voiceId ?? "JBFqnCBsd6RMkjVDRZzb"; // George — multilingual

  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: options.modelId ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }

  const audioBuffer = await res.arrayBuffer();
  return {
    audioBuffer,
    characterCount: text.length,
    costUsd: calculateTtsCost(text.length),
  };
}

/**
 * 글자 수 기반 TTS 비용 계산.
 * ElevenLabs Pro: ~$0.18/1000 credits, 1 credit = 1 char (multilingual).
 * 안전 마진 포함 $0.30/1000자로 추정.
 */
export function calculateTtsCost(charCount: number): number {
  return Math.round((charCount / 1000) * 0.3 * 1_000_000) / 1_000_000;
}

/**
 * 사용량 모니터링 — 월 한도 확인용 (선택).
 */
export async function getUsage(): Promise<{
  character_count: number;
  character_limit: number;
}> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${API_BASE}/user/subscription`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs usage ${res.status}`);
  return res.json();
}
