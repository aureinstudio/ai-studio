import { Agent, parseJsonSafely } from "../base";
import type { ReviewerOutput } from "./reviewer";
import type { FormatCheckerOutput } from "./format-checker";
import type { LearningObjective } from "../team1-planning/comprehensive-analysis";

export type ComprehensiveReviewerInput = {
  reviewer_result: ReviewerOutput;
  format_checker_result: FormatCheckerOutput;
  original_objectives: LearningObjective[];
  topic: string;
};

export type ObjectiveCoverage = {
  objective_id: string;
  coverage_score: number;
  covered_in_sections: string[];
  gaps: string[];
};

export type ComprehensiveReviewerOutput = {
  objective_coverage: ObjectiveCoverage[];
  overall_alignment_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: "approve" | "revise" | "reject";
};

/**
 * Studio Agent #12 — 종합 검토 에이전트 (TEAM 4-Quality).
 * Reviewer(#10) + FormatChecker(#11) 결과 + 원본 학습 목표 → 종합 부합도 평가.
 * recommendation: "approve" → #13 실행 / "revise" → #06~#08 재실행(1회) / "reject" → 실패
 */
export class ComprehensiveReviewer extends Agent<ComprehensiveReviewerInput, ComprehensiveReviewerOutput> {
  readonly id = "studio-12";
  readonly name = "종합 검토";
  readonly role = "학습 목표 부합도 평가";

  protected buildSystemPrompt(_input: ComprehensiveReviewerInput): string {
    return `당신은 종합 검토 에이전트입니다.
역할: ⑩과 ⑪의 결과를 받아 학습 목표 부합도를 종합 평가합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "objective_coverage": [
    {
      "objective_id": "primary-1",
      "coverage_score": 0~100,
      "covered_in_sections": ["섹션명 또는 슬라이드 번호"],
      "gaps": ["미달 항목"]
    }
  ],
  "overall_alignment_score": 0~100,
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "recommendation": "approve|revise|reject"
}

판정 기준:
- overall_alignment_score 85 이상 + 검토·형식 모두 pass → "approve"
- overall_alignment_score 65~84 또는 검토/형식 중 하나 fail → "revise"
- overall_alignment_score 65 미만 또는 critical issue → "reject"

주의:
- "reject"는 재시도로 해결 불가한 구조적 문제에만 사용
- strengths·weaknesses는 각 2~4개, 구체적으로
- 한국어`;
  }

  protected buildUserMessage(input: ComprehensiveReviewerInput): string {
    const objectivesList = input.original_objectives
      .map((o, i) => `  primary-${i + 1}: ${o.primary}\n    → ${o.secondary.join(" / ")}`)
      .join("\n");

    return `주제: "${input.topic}"

=== 원본 학습 목표 (#01) ===
${objectivesList}

=== 검토 결과 (#10) ===
${JSON.stringify(input.reviewer_result, null, 2)}

=== 형식 확인 결과 (#11) ===
${JSON.stringify(input.format_checker_result, null, 2)}

위 결과를 바탕으로 학습 목표 부합도를 종합 평가해주세요.`;
  }

  protected parseOutput(rawText: string): ComprehensiveReviewerOutput {
    return parseJsonSafely<ComprehensiveReviewerOutput>(rawText);
  }
}
