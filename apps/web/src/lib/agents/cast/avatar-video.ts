// AgentLog type retained for future reference but no longer required since the
// legacy polling renderer was removed. Production uses submitHeyGenVideo (async
// webhook) only.

const HEYGEN_API_BASE = "https://api.heygen.com";
// 기본 fallback (호출 시 avatar_id 미제공 시). 동양인 검증 필요.
const DEFAULT_AVATAR_ID = "Anna_public_3_20240108";

/**
 * HeyGen 영상 *제출만* — 폴링 안 함. video_id 즉시 반환.
 * 완료 알림은 webhook을 통해 비동기 처리.
 *
 * Vercel function timeout 무관 — 호출 3~5초 내 종료.
 */
export type AvatarType = "avatar" | "talking_photo";

export async function submitHeyGenVideo(
  scenes: VoiceScene[],
  topic: string,
  castJobId: string,
  avatarId: string = DEFAULT_AVATAR_ID,
  voiceId: string = "1bd001e7e50f421d891986aad5158bc8",
  callbackUrl?: string,
  avatarType: AvatarType = "avatar",
): Promise<{ video_id: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  // PIP 레이아웃 — 우하단 원형 아바타.
  // HeyGen v2 offset/scale 시멘틱은 문서가 모호 — 실측 기반 튜닝 필요.
  // 이전 시도: (0.78, 0.60) scale 0.25 → 아바타 미표시 (offset 범위 초과 추정).
  // 현재 값: 가시성 우선 확보 후 corner-flush 미세조정.
  const PIP_SCALE = 0.28;
  const PIP_OFFSET = { x: 0.15, y: 0.15 };
  const character =
    avatarType === "talking_photo"
      ? {
          type: "talking_photo" as const,
          talking_photo_id: avatarId,
          talking_photo_style: "circle" as const,
          scale: PIP_SCALE,
          offset: PIP_OFFSET,
          matting: true,
        }
      : {
          type: "avatar" as const,
          avatar_id: avatarId,
          avatar_style: "circle" as const,
          scale: PIP_SCALE,
          offset: PIP_OFFSET,
          matting: true,
        };

  const video_inputs = scenes
    .sort((a, b) => a.slide_number - b.slide_number)
    .map((scene) => {
      const background = scene.background_image_url
        ? { type: "image" as const, url: scene.background_image_url, fit: "cover" as const }
        : { type: "color" as const, value: "#0f172a" };
      return {
        character,
        voice: scene.audio_url
          ? ({ type: "audio" as const, audio_url: scene.audio_url })
          : ({ type: "text" as const, input_text: scene.text ?? "", voice_id: voiceId }),
        background,
      };
    });

  const body: Record<string, unknown> = {
    video_inputs,
    dimension: { width: 1920, height: 1080 },
    title: `KEG Cast · ${topic} · ${castJobId.slice(0, 8)}`,
  };
  if (callbackUrl) {
    body.callback_url = callbackUrl;
    body.callback_id = castJobId; // webhook에서 cast_job 매칭용
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(translateHeyGenError(res.status, txt));
  }

  const json = (await res.json()) as { data: { video_id: string } };
  return { video_id: json.data.video_id };
}

/**
 * HeyGen 영문 에러 → 한국어 가이드 메시지.
 */
function translateHeyGenError(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (/insufficient.+credit|api.+credit/i.test(body)) {
    return "HeyGen API 크레딧이 부족합니다. 관리자에게 문의해 주세요. (HeyGen 대시보드 → Settings → API Credits)";
  }
  if (status === 401 || status === 403) {
    return "HeyGen 인증 실패. API 키를 확인해 주세요.";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "HeyGen 호출 한도 초과. 잠시 후 다시 시도해 주세요.";
  }
  if (lower.includes("avatar") && lower.includes("not found")) {
    return "선택한 아바타를 찾을 수 없습니다. 다른 아바타로 다시 시도해 주세요.";
  }
  // 알려진 패턴 외 — 원문 일부 유지
  return `HeyGen 영상 생성 실패 (${status}). ${body.slice(0, 200)}`;
}

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
  // PIP 레이아웃 — 슬라이드 이미지를 영상 background로 사용
  background_image_url?: string;
};

export type VideoResult = {
  video_url: string;
  video_path: string | null; // Supabase Storage 미러 (선택)
  duration_sec: number;
  cost_usd: number;
  heygen_video_id: string;
};
