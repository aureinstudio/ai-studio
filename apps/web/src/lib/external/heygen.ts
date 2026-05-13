/**
 * HeyGen Avatar Video 클라이언트 (fetch 기반, 공식 SDK 없음).
 *
 * ⚠️ 서버 전용. HEYGEN_API_KEY는 NEXT_PUBLIC_ 접두사 *없음*.
 *
 * 가격 (2026-05 기준 추정): ~$0.50 / 분
 * Cast TEAM 3 (다음 단계)에서 사용 — 현재는 스캐폴딩만.
 *
 * 동작:
 * 1. POST /v2/video/generate → video_id 반환 (즉시)
 * 2. GET /v1/video_status.get?video_id={id} → polling (5~10분 소요)
 * 3. status=completed 시 video_url 획득
 */

const API_BASE = "https://api.heygen.com";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60; // 60 × 10s = 10분 최대

export type GenerateVideoInput = {
  avatarId: string;
  voiceId?: string;
  inputText?: string;
  audioUrl?: string;
  title?: string;
};

export type VideoStatus = {
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  durationSeconds?: number;
  errorMessage?: string;
};

/**
 * 영상 생성 시작 — video_id 즉시 반환.
 * 실제 완성은 pollVideoStatus로 폴링.
 */
export async function startVideoGeneration(
  input: GenerateVideoInput,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  const body = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: input.avatarId,
          avatar_style: "normal",
        },
        voice: input.audioUrl
          ? { type: "audio", audio_url: input.audioUrl }
          : {
              type: "text",
              input_text: input.inputText ?? "",
              voice_id: input.voiceId ?? "1bd001e7e50f421d891986aad5158bc8",
            },
      },
    ],
    dimension: { width: 1920, height: 1080 },
    title: input.title ?? `Cast video ${Date.now()}`,
  };

  const res = await fetch(`${API_BASE}/v2/video/generate`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HeyGen generate ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as { data: { video_id: string } };
  return { videoId: data.data.video_id };
}

/**
 * 영상 상태 조회 (단일 호출).
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  const res = await fetch(
    `${API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    { headers: { "X-Api-Key": apiKey } },
  );
  if (!res.ok) throw new Error(`HeyGen status ${res.status}`);

  const json = (await res.json()) as {
    data: {
      status: string;
      video_url?: string;
      duration?: number;
      error?: { message?: string };
    };
  };
  return {
    videoId,
    status: (json.data.status as VideoStatus["status"]) ?? "pending",
    videoUrl: json.data.video_url,
    durationSeconds: json.data.duration,
    errorMessage: json.data.error?.message,
  };
}

/**
 * 완료까지 폴링 — 10초 간격, 최대 10분.
 */
export async function pollVideoStatus(videoId: string): Promise<VideoStatus> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const status = await getVideoStatus(videoId);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`HeyGen polling timeout after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * 영상 길이 기반 비용 계산.
 *
 * 플랜에 따라 분당 단가가 크게 다름:
 *   Pay-as-you-go (API standard) — $2.00~$6.00/분
 *   Creator $24/월 + 초과분        — ~$2.00/분 (실측)
 *   Team $79/월                    — ~$0.50/분
 *   Enterprise                     — 협상가 $0.10~$0.30/분
 *
 * 본부장 환경 단가를 HEYGEN_USD_PER_MINUTE 환경변수로 override 가능 (기본 2.0).
 * 부정확한 비용 추적은 cost-guard 자동 차단을 무력화 → 정확한 단가 입력 필수.
 */
export function calculateVideoCost(durationSeconds: number): number {
  const usdPerMinute = Number(process.env.HEYGEN_USD_PER_MINUTE ?? "2.0");
  const cost = (durationSeconds / 60) * usdPerMinute;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
