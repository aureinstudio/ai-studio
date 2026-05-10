import { Agent, parseJsonSafely } from "../base";
import type { LearningProcessOutput } from "../team2-production/learning-process-curator";
import type { CuratorOutput } from "../team2/content-curator";
import type { PlannerOutput } from "../team2/visual-planner";
import type { InfographicOutput } from "../team2-production/infographic-designer";

export type FormatCheckerInput = {
  learning_sequence: LearningProcessOutput;
  content: CuratorOutput;
  slide_plan: PlannerOutput;
  infographics: InfographicOutput;
};

export type FormatScoreWithViolations = {
  score: number;
  violations: string[];
};

export type FormatCheckerOutput = {
  structural_compliance: FormatScoreWithViolations;
  naming_conventions: FormatScoreWithViolations;
  metadata_completeness: {
    score: number;
    missing: string[];
  };
  auto_fixable_issues: string[];
  manual_review_required: string[];
  overall_pass: boolean;
};

/**
 * Studio Agent #11 — 형식 확인 에이전트 (TEAM 4-Quality).
 * TEAM 2 전체 산출물 → 형식·구조 표준 준수 검증.
 * 병렬: Reviewer(#10)와 동시 실행.
 */
export class FormatChecker extends Agent<FormatCheckerInput, FormatCheckerOutput> {
  readonly id = "studio-11";
  readonly name = "형식 확인";
  readonly role = "구조·표준 준수 검증";
  protected get maxTokens(): number { return 3072; }

  protected buildSystemPrompt(_input: FormatCheckerInput): string {
    return `당신은 형식 확인 에이전트입니다.
역할: 산출물의 형식·구조 표준 준수를 검증합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "structural_compliance": { "score": 0~100, "violations": [...] },
  "naming_conventions": { "score": 0~100, "violations": [...] },
  "metadata_completeness": { "score": 0~100, "missing": [...] },
  "auto_fixable_issues": [...],
  "manual_review_required": [...],
  "overall_pass": true|false
}

체크 항목:
- JSON 스키마 일치 (필수 필드 존재 여부)
- 슬라이드 번호 연속성 (1, 2, 3... 순서 깨짐 여부)
- 인포그래픽 slide_number가 슬라이드 플랜과 일치하는지
- 학습 목표 3개 (Bloom 동사 시작) 준수
- 섹션 paragraphs 3문단 이상 여부
- step_number 연속성
- 필수 필드 누락 여부

기각 기준:
- 어느 한 score가 60 미만 → overall_pass: false
- 슬라이드 번호 불일치·필수 필드 누락은 무조건 위반
- 한국어`;
  }

  protected buildUserMessage(input: FormatCheckerInput): string {
    return `다음 TEAM 2 산출물의 형식과 구조를 검증해주세요.

=== 학습 시퀀스 (#05) ===
${JSON.stringify(input.learning_sequence, null, 2)}

=== 본문 큐레이터 (#06) ===
${JSON.stringify(input.content, null, 2)}

=== 슬라이드 플랜 (#07) ===
${JSON.stringify(input.slide_plan, null, 2)}

=== 인포그래픽 (#08) ===
${JSON.stringify(input.infographics, null, 2)}`;
  }

  protected parseOutput(rawText: string): FormatCheckerOutput {
    return parseJsonSafely<FormatCheckerOutput>(rawText);
  }
}
