import { Agent, parseJsonSafely } from "../base";
import type { CuratorOutput } from "./content-curator";

export type PlannerInput = {
  curated: CuratorOutput;
};

export type Slide = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

export type PlannerOutput = {
  slides: Slide[];
};

/**
 * Studio Agent #07 — 시각 디자인 기획 (TEAM 2).
 * 큐레이터 본문 → 슬라이드 메타데이터 재구조화.
 */
export class VisualPlanner extends Agent<PlannerInput, PlannerOutput> {
  readonly id = "studio-07";
  readonly name = "시각 디자인 기획";
  readonly role = "본문 → 슬라이드 재구조화 + 강사 노트";

  protected buildSystemPrompt(_input: PlannerInput): string {
    return `당신은 KEG 시각 디자인 기획 에이전트입니다.
역할: 콘텐츠 큐레이터가 작성한 본문을 슬라이드 형태로 재구조화합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지, 추가 설명 금지:
{
  "slides": [
    {
      "slide_number": 1,
      "title": "슬라이드 제목",
      "content_blocks": ["글머리1", "글머리2"],
      "visual_suggestions": "도표·이미지 제안 (예: '왼쪽 칼 그립 사진, 오른쪽 위험 영역 다이어그램')",
      "speaker_notes": "강사가 슬라이드를 보며 읽을 노트 (슬라이드의 2~3배 분량)"
    }
  ]
}

제약:
- 슬라이드 *총 6~10장* (너무 많으면 안 됨)
- 슬라이드 1장당 핵심 메시지 1개 (제목에 반영)
- content_blocks는 *3~5개 이내* 글머리 기호, 각 50자 이내
- speaker_notes는 *200자 내외* (각 슬라이드, 너무 길면 안 됨)
- visual_suggestions는 *80자 이내*, 구체적으로 (단순 "이미지 추천" 금지)
- 큐레이터 본문(main_content)을 *모두* 커버 — 누락 0건
- 첫 슬라이드는 챕터 제목·학습 목표 카드, 마지막 슬라이드는 정리·다음 학습 안내
- 전체 출력은 ~5000 tokens 이내 (한 글자도 말투 늘이지 말 것)`;
  }

  protected buildUserMessage(input: PlannerInput): string {
    return `다음 큐레이터 본문을 슬라이드로 재구조화해주세요.

=== 큐레이터 본문 JSON ===
${JSON.stringify(input.curated, null, 2)}

위 JSON의 main_content를 모두 커버하도록 슬라이드를 설계해주세요.`;
  }

  protected parseOutput(rawText: string): PlannerOutput {
    return parseJsonSafely<PlannerOutput>(rawText);
  }
}
