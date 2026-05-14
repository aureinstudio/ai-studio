/**
 * 슬라이드별 시각 자료 계획 — Gemini text 호출.
 *
 * 입력: 슬라이드 title + content_blocks
 * 출력: { type, search_term, image_prompt }
 *   - "photo"   : 실사진 (Unsplash 검색 권장)
 *   - "concept" : AI 생성 (다이어그램·일러스트·콘셉트 이미지)
 *   - "none"    : 시각 자료 불필요 (인트로/엔딩 등)
 */

export type VisualPlan = {
  type: "photo" | "concept" | "none";
  search_term: string;
  image_prompt: string;
};

const SYSTEM_INSTRUCTION = `당신은 교육 슬라이드 시각 자료 기획자입니다.
각 슬라이드 내용을 보고 어떤 시각 자료가 학습 효과에 가장 좋을지 결정하고,
Gemini 이미지 생성용 영어 프롬프트를 만듭니다.

기준:
- photo: 사실적 사진 스타일이 효과적인 경우 (음식·도구·풍경·인물 등 구체적 객체)
- concept: 추상 개념·다이어그램·플로우·구조 — minimalist 일러스트가 효과적
- none: 인트로/엔딩/순수 텍스트 강조 슬라이드 — 시각 자료 불필요

응답은 반드시 JSON 한 개 객체만 출력. 다른 텍스트 금지.
{
  "type": "photo|concept|none",
  "search_term": "" (사용 안 함, 빈 문자열),
  "image_prompt": "Gemini 이미지 생성용 영어 프롬프트.
    photo type → 'photorealistic photograph of ..., natural lighting, professional, high detail, 16:9 widescreen, no text'
    concept type → 'minimalist educational illustration about ..., clean modern design, suitable for slide, 16:9 widescreen, no text or letters'"
}`;

export async function planSlideVisual(
  topic: string,
  slide: { title: string; content_blocks?: string[]; slide_number?: number },
): Promise<VisualPlan> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { type: "none", search_term: "", image_prompt: "" };
  }

  const slideContext = `주제: ${topic}
슬라이드 #${slide.slide_number ?? "?"}
제목: ${slide.title}
내용:
${(slide.content_blocks ?? []).slice(0, 5).map((b) => `- ${b}`).join("\n")}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ parts: [{ text: slideContext }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!res.ok) return { type: "none", search_term: "", image_prompt: "" };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as Partial<VisualPlan>;
    if (parsed.type !== "photo" && parsed.type !== "concept" && parsed.type !== "none") {
      return { type: "none", search_term: "", image_prompt: "" };
    }
    return {
      type: parsed.type,
      search_term: parsed.search_term?.toString().slice(0, 200) ?? "",
      image_prompt: parsed.image_prompt?.toString().slice(0, 500) ?? "",
    };
  } catch {
    return { type: "none", search_term: "", image_prompt: "" };
  }
}
