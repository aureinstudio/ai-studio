import { Agent, parseJsonSafely } from "../base";
import type { PlannerOutput } from "../team2/visual-planner";

export type Infographic = {
  slide_number: number;
  type: "comparison" | "process" | "hierarchy" | "timeline" | "matrix" | "none";
  title: string;
  elements: string[];
  layout_description: string;
  color_emphasis: string[];
};

export type InfographicOutput = {
  infographics: Infographic[];
};

export type InfographicInput = {
  slide_plan: PlannerOutput;
  topic: string;
  level: string;
};

/**
 * Studio Agent #08 — 인포그래픽 디자이너 (TEAM 2-Production).
 * Visual Planner(#07) 슬라이드 구조 → 인포그래픽·도표 명세.
 */
export class InfographicDesigner extends Agent<InfographicInput, InfographicOutput> {
  readonly id = "studio-08";
  readonly name = "인포그래픽 디자이너";
  readonly role = "도표·인포그래픽 명세";

  protected buildSystemPrompt(input: InfographicInput): string {
    return `당신은 인포그래픽 디자이너입니다.
역할: Visual Planner(⑦)가 만든 슬라이드 구조를 받아, 각 슬라이드에 들어갈 인포그래픽·도표 명세를 작성합니다.

주제: ${input.topic}
수준: ${input.level}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "infographics": [
    {
      "slide_number": 1,
      "type": "comparison|process|hierarchy|timeline|matrix|none",
      "title": "...",
      "elements": [...],
      "layout_description": "...",
      "color_emphasis": [...]
    }
  ]
}

제약:
- infographics 배열은 슬라이드 수와 동일 (각 슬라이드마다 1개 entry, type=none 허용)
- 전체 슬라이드 중 최소 2개는 type이 none이 아닌 인포그래픽
- 자격증 과정은 process나 matrix 타입 권장
- elements는 인포그래픽 안에 들어갈 텍스트 요소 목록 (2~6개)
- layout_description은 100자 이내 구체적 배치 설명
- color_emphasis는 강조할 색상·톤 1~3개 (예: "위험-빨강", "핵심-파랑")
- 한국어`;
  }

  protected buildUserMessage(input: InfographicInput): string {
    return `다음 슬라이드 플랜을 바탕으로 각 슬라이드의 인포그래픽 명세를 작성해주세요.

=== 슬라이드 플랜 (#07) ===
${JSON.stringify(input.slide_plan, null, 2)}`;
  }

  protected parseOutput(rawText: string): InfographicOutput {
    return parseJsonSafely<InfographicOutput>(rawText);
  }
}
