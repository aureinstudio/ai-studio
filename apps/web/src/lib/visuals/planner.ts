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
각 슬라이드 내용을 보고 어떤 시각 자료가 학습 효과에 가장 좋을지 결정합니다.

기준:
- 실사진(photo): 실제 사물/상황/사람 — 음식·도구·풍경·인물 등 구체적 객체
- 콘셉트(concept): 추상 개념·다이어그램·플로우·구조 — AI 생성 일러스트가 적합
- 없음(none): 인트로/엔딩/순수 텍스트 강조 슬라이드

응답은 반드시 JSON 한 개 객체만 출력. 다른 텍스트 금지.
{
  "type": "photo|concept|none",
  "search_term": "Unsplash 검색용 영어 키워드 (photo일 때)",
  "image_prompt": "AI 이미지 생성용 영어 프롬프트 (concept일 때 — minimalist educational illustration 스타일)"
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
