/**
 * Google Gemini — 텍스트 → 이미지 생성.
 *
 * Imagen 3 (imagen-3.0-generate-002)는 일부 계정에서 사용 불가 (paid Vertex AI 전용).
 * 무료 Gemini API에서 이미지 생성 가능한 모델 우선 시도 + fallback.
 *
 * 시도 순서:
 *   1. imagen-3.0-fast-generate-001 (:predict) — Imagen 3 fast
 *   2. imagen-3.0-generate-001 (:predict) — Imagen 3 standard
 *   3. gemini-2.5-flash-image-preview (:generateContent) — Gemini multimodal
 *   4. gemini-2.0-flash-exp-image-generation (:generateContent) — 실험 버전
 *
 * 본 클라이언트는 KEG ai-studio용 — 동양인 강사 아바타 이미지 생성에 특화.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

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
  model_used: string;
  cost_usd: number;
};

const AGE_DESC: Record<GenerateAvatarOptions["age_group"], string> = {
  "20s": "in their 20s, young and energetic",
  "30s": "in their 30s, professional",
  "40s": "in their 40s, experienced",
  "50s": "in their 50s, senior expert",
};

function buildPrompt(options: GenerateAvatarOptions): string {
  const genderDesc =
    options.gender === "female" ? "Korean female" : "Korean male";

  return [
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
}

/**
 * Imagen 모델 호출 (:predict 엔드포인트).
 */
async function tryImagen(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ base64: string; mimeType: "image/png" | "image/jpeg" } | null> {
  const url = `${API_BASE}/models/${model}:predict?key=${apiKey}`;
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
  if (!res.ok) return null;
  const json = (await res.json()) as {
    predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
  };
  const p = json.predictions?.[0];
  if (!p?.bytesBase64Encoded) return null;
  return {
    base64: p.bytesBase64Encoded,
    mimeType: (p.mimeType as "image/png" | "image/jpeg") ?? "image/png",
  };
}

/**
 * Gemini 멀티모달 모델 호출 (:generateContent 엔드포인트, IMAGE modality).
 */
async function tryGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ base64: string; mimeType: "image/png" | "image/jpeg" } | null> {
  const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { mimeType?: string; data?: string } }[];
      };
    }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: (part.inlineData.mimeType as "image/png" | "image/jpeg") ?? "image/png",
      };
    }
  }
  return null;
}

const MODELS_TO_TRY: { kind: "imagen" | "gemini"; name: string; cost: number }[] = [
  { kind: "imagen", name: "imagen-3.0-fast-generate-001", cost: 0.02 },
  { kind: "imagen", name: "imagen-3.0-generate-001", cost: 0.04 },
  { kind: "gemini", name: "gemini-2.5-flash-image-preview", cost: 0.04 },
  { kind: "gemini", name: "gemini-2.0-flash-exp-image-generation", cost: 0.04 },
];

export async function generateAvatarImage(
  options: GenerateAvatarOptions,
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY (또는 GOOGLE_API_KEY) not configured");
  }

  const prompt = buildPrompt(options);
  const errors: string[] = [];

  for (const m of MODELS_TO_TRY) {
    try {
      const result =
        m.kind === "imagen"
          ? await tryImagen(apiKey, m.name, prompt)
          : await tryGemini(apiKey, m.name, prompt);
      if (result) {
        return {
          base64: result.base64,
          mimeType: result.mimeType,
          prompt_used: prompt,
          model_used: m.name,
          cost_usd: m.cost,
        };
      }
      errors.push(`${m.name}: returned no image`);
    } catch (err) {
      errors.push(`${m.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `All image generation models failed:\n${errors.join("\n")}`,
  );
}
