import { Agent, parseJsonSafely } from "../base";
import type { LearningProcessOutput } from "../team2-production/learning-process-curator";
import type { CuratorOutput } from "../team2/content-curator";
import type { PlannerOutput } from "../team2/visual-planner";
import type { InfographicOutput } from "../team2-production/infographic-designer";

export type ReviewerInput = {
  learning_sequence: LearningProcessOutput;
  content: CuratorOutput;
  slide_plan: PlannerOutput;
  infographics: InfographicOutput;
  topic: string;
};

export type ScoreWithIssues = {
  score: number;
  issues: string[];
};

export type ReviewerOutput = {
  factual_accuracy: ScoreWithIssues;
  consistency: ScoreWithIssues;
  completeness: {
    score: number;
    missing_elements: string[];
  };
  overall_pass: boolean;
};

/**
 * Studio Agent #10 — 검토 에이전트 (TEAM 4-Quality).
 * TEAM 2 전체 산출물 → 내용 정확성·일관성·완성도 검증.
 * 병렬: FormatChecker(#11)와 동시 실행.
 */
export class Reviewer extends Agent<ReviewerInput, ReviewerOutput> {
  readonly id = "studio-10";
  readonly name = "검토";
  readonly role = "내용 정확성·일관성 검증";
  protected get maxTokens(): number { return 2048; }

  protected buildSystemPrompt(_input: ReviewerInput): string {
    return `당신은 검토 에이전트입니다.
역할: TEAM 2의 모든 산출물을 받아 내용 정확성과 일관성을 검증합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "factual_accuracy": {
    "score": 0~100,
    "issues": [...]
  },
  "consistency": {
    "score": 0~100,
    "issues": ["학습 목표-본문 불일치 등"]
  },
  "completeness": {
    "score": 0~100,
    "missing_elements": [...]
  },
  "overall_pass": true|false
}

기각 기준:
- factual_accuracy, consistency, completeness 중 하나라도 60 미만 → overall_pass: false
- critical issue (사실 오류·학습 목표 미달) 발견 시 → overall_pass: false
- 한국어`;
  }

  protected buildUserMessage(input: ReviewerInput): string {
    return `다음 TEAM 2 산출물 전체를 검토해주세요. 주제: "${input.topic}"

=== 학습 시퀀스 (#05) ===
${JSON.stringify(input.learning_sequence, null, 2)}

=== 본문 큐레이터 (#06) ===
${JSON.stringify(input.content, null, 2)}

=== 슬라이드 플랜 (#07) ===
${JSON.stringify(input.slide_plan, null, 2)}

=== 인포그래픽 (#08) ===
${JSON.stringify(input.infographics, null, 2)}`;
  }

  protected parseOutput(rawText: string): ReviewerOutput {
    return parseJsonSafely<ReviewerOutput>(rawText);
  }
}
