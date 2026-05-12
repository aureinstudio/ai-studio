import { Agent, parseJsonSafely } from "../base";
import type { ComprehensionOutput } from "./comprehension-evaluator";

export type RecommendationInput = {
  course_topic: string;
  comprehension: ComprehensionOutput;
  weeks_until_exam?: number;
};

export type ImmediateAction = {
  action_type: "review" | "practice" | "advance" | "rest" | "ask_instructor";
  target: string;
  rationale: string;
  estimated_duration_minutes: number;
  priority: "high" | "medium" | "low";
};

export type RecommendationOutput = {
  immediate_actions: ImmediateAction[];
  weekly_plan: string[];
  exam_prep_schedule: {
    weeks_before: number;
    focus: string;
  }[];
  motivational_message: string;
};

/**
 * Tutor Agent #06 — 학습 권장 (#05 결과 기반).
 *
 * 이해도 평가 → 개인화된 다음 학습 단계 제안.
 *
 * 원칙:
 *   - 약점 영역 우선 (단, 한 번에 1~2개)
 *   - 강점도 가끔 (자신감 유지)
 *   - 휴식 권장 (번아웃 방지)
 *   - 시험까지 기간 고려한 일정
 */
export class RecommendationEngine extends Agent<
  RecommendationInput,
  RecommendationOutput
> {
  readonly id = "tutor-06";
  readonly name = "학습 권장";
  readonly role = "개인화된 학습 경로 제안";

  protected get temperature(): number {
    return 0.4;
  }

  protected buildSystemPrompt(input: RecommendationInput): string {
    return `당신은 학습 경로 권장 에이전트입니다.
역할: 이해도 평가 결과를 바탕으로 개인화된 다음 학습 단계를 제안합니다.

과정 주제: ${input.course_topic}
${input.weeks_until_exam ? `시험까지 ${input.weeks_until_exam}주 남음` : "시험 일정 미정"}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "immediate_actions": [
    {
      "action_type": "review | practice | advance | rest | ask_instructor",
      "target": "복습할 챕터·섹션·개념",
      "rationale": "이 행동을 추천하는 이유 (1문장)",
      "estimated_duration_minutes": 30,
      "priority": "high | medium | low"
    }
  ],
  "weekly_plan": [
    "1주차: ...",
    "2주차: ..."
  ],
  "exam_prep_schedule": [
    { "weeks_before": 4, "focus": "약점 영역 집중" },
    { "weeks_before": 2, "focus": "기출 문제 풀이" },
    { "weeks_before": 1, "focus": "총정리·휴식 조절" }
  ],
  "motivational_message": "학생에게 보낼 격려 한국어 메시지 (2~3문장)"
}

원칙:
- immediate_actions 3~5개. 한 번에 너무 많이 X
- 약점 영역 우선이지만 1~2개씩만 (overload 방지)
- "rest" 액션도 가끔 — 학생 번아웃 방지
- "ask_instructor" — comprehension의 weak_concepts가 심각할 때
- target은 구체적으로 (챕터·섹션·개념명)
- motivational_message는 trend 반영:
  · improving → "잘 진행 중이에요" 격려
  · stable → "꾸준함이 강점이에요" 인정
  · declining → "잠시 호흡 가다듬어요" 부드럽게
- 한국어`;
  }

  protected buildUserMessage(input: RecommendationInput): string {
    return `이해도 평가 결과:
${JSON.stringify(input.comprehension, null, 2)}

위 결과를 바탕으로 개인화된 학습 권장을 작성해주세요.`;
  }

  protected parseOutput(rawText: string): RecommendationOutput {
    return parseJsonSafely<RecommendationOutput>(rawText);
  }
}
