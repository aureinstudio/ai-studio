import { Agent, parseJsonSafely } from "../base";

export type TutorOrchestratorInput = {
  question: string;
  intent: string;
  complexity: "simple" | "medium" | "complex";
  conversation_total_messages: number;
  rejected_count: number;
  has_understanding_record: boolean;
};

export type ExecutionStep = {
  agent_id: string;
  reason: string;
};

export type TutorOrchestratorOutput = {
  execution_plan: ExecutionStep[];
  handoff_decision: {
    human_required: boolean;
    video_response_helpful: boolean;
    estimated_response_time_sec: number;
  };
  caching_strategy: "cache_check" | "force_fresh" | "skip";
  trigger_comprehension_eval: boolean;
  trigger_safety_check: boolean;
};

/**
 * Tutor Agent #07 — 메타 오케스트레이터 (경량 Haiku).
 *
 * 입력 분석 → 어떤 에이전트가 어떤 순서로 작동할지 결정.
 * 기본 흐름 (#01·#03·#02·#04·#08)은 항상 실행. #05·#06·#09는 조건부.
 *
 * 결정 사항:
 *   - 풀 흐름 vs 단순화 (complexity=simple이면 일부 스킵 가능)
 *   - #05 이해도 평가 자동 트리거 여부
 *   - #09 안전 감지 자동 트리거 여부
 *   - 강사 핸드오프 필요 여부
 *   - Cast Mode B 영상 응답 권장 여부
 *
 * Haiku 4.5 사용 (~$0.001/호출).
 */
export class TutorOrchestrator extends Agent<
  TutorOrchestratorInput,
  TutorOrchestratorOutput
> {
  readonly id = "tutor-07";
  readonly name = "Tutor 오케스트레이터";
  readonly role = "에이전트 라우팅·트리거 결정";

  protected get temperature(): number {
    return 0.1;
  }

  protected buildSystemPrompt(_input: TutorOrchestratorInput): string {
    return `당신은 Tutor 9-에이전트 메타 오케스트레이터입니다.
역할: 학생 입력을 분석하여 어떤 에이전트를 트리거할지 결정합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "execution_plan": [
    { "agent_id": "tutor-01", "reason": "..." },
    { "agent_id": "tutor-03", "reason": "..." }
  ],
  "handoff_decision": {
    "human_required": true | false,
    "video_response_helpful": true | false,
    "estimated_response_time_sec": 5
  },
  "caching_strategy": "cache_check | force_fresh | skip",
  "trigger_comprehension_eval": true | false,
  "trigger_safety_check": true | false
}

라우팅 규칙:
- intent=personal_emotion → human_required=true (강사 핸드오프)
- intent=off_topic → trigger_safety_check=true (반복 시 의심)
- complexity=simple → execution_plan에 핵심만 (#01·#03·#04·#08)
- complexity=complex → 풀 흐름 (#01·#03·#02·#04·#08)
- conversation_total_messages >= 10 + !has_understanding_record → trigger_comprehension_eval=true
- rejected_count >= 3 → trigger_safety_check=true
- intent=concept_question + complexity=complex + visual 도움됨 → video_response_helpful=true

caching_strategy:
- cache_check: 동일 질문 FAQ 캐시 시도 (Phase 2)
- force_fresh: 새 응답 (개인화 필요 시)
- skip: 캐시 무관 (현재 베타 기본)

핵심: 한국어 응답`;
  }

  protected buildUserMessage(input: TutorOrchestratorInput): string {
    return `학생 입력:
- 질문: "${input.question.slice(0, 200)}"
- intent: ${input.intent}
- complexity: ${input.complexity}
- 대화 누적 메시지: ${input.conversation_total_messages}
- rejected 누적: ${input.rejected_count}
- 이해도 기록 보유: ${input.has_understanding_record}

위 입력에 대해 라우팅·트리거 결정을 내려주세요.`;
  }

  protected parseOutput(rawText: string): TutorOrchestratorOutput {
    return parseJsonSafely<TutorOrchestratorOutput>(rawText);
  }
}
