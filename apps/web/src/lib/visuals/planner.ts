/**
 * 슬라이드별 시각 자료 계획 — Gemini text 호출.
 *
 * 입력: 슬라이드 title + content_blocks
 * 출력: { type, reason, image_prompt }
 *   - "photo"   : 실사진 스타일 (Gemini Image — photorealistic)
 *   - "concept" : AI 일러스트 (다이어그램·일러스트·콘셉트)
 *   - "none"    : 시각 자료 불필요 (기본값 — 의심 시 none)
 */

export type VisualPlan = {
  type: "photo" | "concept" | "none";
  reason: string;
  image_prompt: string;
};

const SYSTEM_INSTRUCTION = `당신은 교육 슬라이드 시각 자료 기획자입니다.
각 슬라이드를 보고 "이미지가 학습 효과를 정말로 향상시키는가?"를 보수적으로 판단합니다.

** 기본값은 "none"입니다. ** 다음 조건 중 하나 이상에 명확히 해당할 때만 photo/concept를 선택합니다:

photo (실사진) 선택 기준:
  - 슬라이드가 구체적인 사물·장소·음식·도구·풍경·인물 등 시각화하면 즉시 이해되는 대상을 다룸
  - 글로만 설명하면 추상적이지만 사진 1장이면 명확해지는 경우
  예: "비빔밥 재료", "현미경 부품", "에펠탑 구조"

concept (다이어그램·일러스트) 선택 기준:
  - 다단계 프로세스·구조·관계도·플로우 등 시각 도식이 본질적으로 필요한 경우
  - 추상 개념이지만 시각화하면 학습 효과가 크게 향상되는 경우
  예: "뉴런 구조", "데이터 흐름", "조직 위계"

none (시각 자료 없음 — 기본값) 선택 기준:
  - 인트로/엔딩/요약/목차 슬라이드
  - 학습 목표 나열·체크리스트·키워드 정의 슬라이드
  - 텍스트 자체로 충분히 이해되는 내용
  - 이미지를 넣으면 오히려 산만해지거나 장식적일 가능성이 높은 경우
  - 정확한 시각화가 어렵고 환각 이미지 가능성이 있는 경우

응답은 반드시 JSON 한 개 객체만 출력. 다른 텍스트 금지.
{
  "type": "photo|concept|none",
  "reason": "선택 근거 한 줄 (한국어)",
  "image_prompt": "Gemini 이미지 생성용 영어 프롬프트 (type !== 'none' 일 때만 작성).
    photo type → 'photorealistic photograph of ..., natural lighting, professional, high detail, 16:9 widescreen, no text'
    concept type → 'minimalist educational illustration about ..., clean modern design, suitable for slide, 16:9 widescreen, no text or letters'"
}

신중하게 판단하세요. 의심스러우면 none을 선택합니다.`;

export async function planSlideVisual(
  topic: string,
  slide: { title: string; content_blocks?: string[]; slide_number?: number },
): Promise<VisualPlan> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { type: "none", reason: "", image_prompt: "" };
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
    if (!res.ok) return { type: "none", reason: "", image_prompt: "" };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as Partial<VisualPlan>;
    if (parsed.type !== "photo" && parsed.type !== "concept" && parsed.type !== "none") {
      return { type: "none", reason: "invalid type from planner", image_prompt: "" };
    }
    return {
      type: parsed.type,
      reason: parsed.reason?.toString().slice(0, 200) ?? "",
      image_prompt: parsed.image_prompt?.toString().slice(0, 500) ?? "",
    };
  } catch {
    return { type: "none", reason: "planner error or parse fail", image_prompt: "" };
  }
}
