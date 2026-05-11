/**
 * Google Gemini Imagen 3 — 텍스트 → 이미지 생성.
 *
 * 엔드포인트: imagen-3.0-generate-002:predict
 * 가격: ~$0.04/이미지 (1024×1024)
 *
 * 본 클라이언트는 KEG ai-studio용 — 동양인 강사 아바타 이미지 생성에 특화.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "imagen-3.0-generate-002";

export type GenerateAvatarOptions = {
  gender: "male" | "female";
  age_group: "20s" | "30s" | "40s" | "50s";
  /** 추가 묘사 (선택). 예: "안경 착용, 단발 헤어" */
  extra_description?: string;
};

export type GeneratedImage = {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  prompt_used: string;
  cost_usd: number;
};

const AGE_DESC: Record<GenerateAvatarOptions["age_group"], string> = {
  "20s": "in their 20s, young and energetic",
  "30s": "in their 30s, professional",
  "40s": "in their 40s, experienced",
  "50s": "in their 50s, senior expert",
};

/**
 * 동양인 강사 avatar 이미지 생성.
 * 강의용 talking_photo로 사용할 정면·중립 배경 사진.
 */
export async function generateAvatarImage(
  options: GenerateAvatarOptions,
): Promise<GeneratedImage> {
  // 둘 중 하나 설정되면 작동 — 본부장이 GEMINI_API_KEY 또는 GOOGLE_API_KEY 중 선호 이름 사용 가능
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY (또는 GOOGLE_API_KEY) not configured");
  }

  const genderDesc =
    options.gender === "female" ? "Korean female" : "Korean male";

  const prompt = [
    `Professional headshot photograph of a ${genderDesc} teacher ${AGE_DESC[options.age_group]}.`,
    "Photorealistic, high-quality professional studio portrait.",
    "Wearing business attire (suit or business casual).",
    "Friendly, approachable expression with a slight smile.",
    "Looking straight at camera, head and shoulders visible.",
    "Clean, plain neutral light gray background.",
    "Even, professional studio lighting.",
    "Sharp focus on face, photorealistic skin texture.",
    "Korean ethnicity (East Asian features).",
    "No text, no watermarks, no logos.",
    options.extra_description
      ? `Additional details: ${options.extra_description}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const url = `${API_BASE}/models/${MODEL}:predict?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: "block_only_high",
        personGeneration: "allow_adult",
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini Imagen ${res.status}: ${txt.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
  };

  const prediction = json.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error(
      `Gemini Imagen returned no image: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: (prediction.mimeType as "image/png" | "image/jpeg") ?? "image/png",
    prompt_used: prompt,
    cost_usd: 0.04,
  };
}
