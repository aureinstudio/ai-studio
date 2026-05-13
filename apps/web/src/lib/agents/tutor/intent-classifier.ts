import { Agent, parseJsonSafely } from "../base";

export type IntentType =
  | "concept_question"
  | "example_request"
  | "exam_prep"
  | "feedback_request"
  | "personal_emotion"
  | "off_topic";

export type IntentClassifierInput = {
  question: string;
  course_topic: string;
  conversation_summary?: string;
};

export type IntentClassifierOutput = {
  intent: IntentType;
  confidence: number;
  complexity: "simple" | "medium" | "complex";
  requires_video_response: boolean;
  requires_human_handoff: boolean;
  context_needed: string[];
};

/**
 * Tutor Agent #01 — 의도 분류 (Haiku, 속도·비용 최적화).
 *
 * 학생 질문 → 6개 intent 카테고리 분류 → 후속 처리 방향 결정.
 * Haiku 4.5 사용 (~$0.001/호출, 1~2초).
 *
 * 분기:
 *   - off_topic: RAG 검색 스킵, 정중 거절
 *   - personal_emotion: 강사 핸드오프 안내
 *   - 나머지: 정상 RAG → 답변 흐름
 */
export class IntentClassifier extends Agent<IntentClassifierInput, IntentClassifierOutput> {
  readonly id = "tutor-01";
  readonly name = "의도 분류";
  readonly role = "질문 유형·복잡도·처리방향 판정";

  protected get temperature(): number {
    return 0.1;
  }

  protected buildSystemPrompt(_input: IntentClassifierInput): string {
    return `당신은 학생 질문 의도 분류 에이전트입니다.
역할: 학생 질문 유형을 분류하여 적절한 처리 방향을 결정합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "intent": "concept_question | example_request | exam_prep | feedback_request | personal_emotion | off_topic",
  "confidence": 0~100,
  "complexity": "simple | medium | complex",
  "requires_video_response": true | false,
  "requires_human_handoff": true | false,
  "context_needed": ["curriculum_position", "previous_attempts", "weakness_areas"]
}

intent 정의:
- concept_question: 개념·정의 설명 요청 (대다수)
- example_request: 예제·사례·문제 요청
- exam_prep: 시험 대비·기출 패턴 질문
- feedback_request: 본인 답안·풀이에 대한 피드백 요청
- personal_emotion: 학습 좌절·동기·정서 — 강사 핸드오프 권장
- off_topic: 교재와 명확히 무관한 경우만 (정치·스포츠·연예 등). 정중 거절, RAG 스킵.

⚠️ off_topic 판정은 매우 보수적으로:
- 과정 주제와 조금이라도 관련되면 concept_question으로 분류
- 모호하거나 일반적인 질문도 과정 맥락에서 답변 가능하면 concept_question
- 예: 한식 양념 과정 → "기초 양념은 뭐가 있어요?" "발효란?" "왜 짠가?" → 모두 concept_question
- 예: 한식 양념 과정 → "오늘 날씨 어때요?" "주식 추천?" → off_topic
- 학생이 막연하게 물어도 강사가 답할 만한 질문이면 RAG로 넘김

complexity:
- simple: 1~2문장으로 답할 수 있음 (정의, 단순 사실)
- medium: 짧은 설명 + 예시 (대다수 개념 질문)
- complex: 다단계 추론, 비교, 분석 (시험 풀이, 심화 개념)

requires_video_response:
- true: 시각적 설명이 핵심 (도형, 흐름도, 프로세스). 영상이 실제 도움됨.
- false: 텍스트로 충분 (대다수)

requires_human_handoff:
- true: personal_emotion intent이거나, 학생이 명시적으로 강사 연락 원함
- true: 응답 거부가 정확한 경우 (사생활·민감 질문)
- false: 일반 학습 질문 (대다수)

context_needed: 답변에 필요한 추가 컨텍스트 항목 (1~3개)
- curriculum_position: 학생이 어디까지 진도 나갔는지
- previous_attempts: 같은 주제 이전 질문·실수
- weakness_areas: 학생이 약한 영역

한국어 또는 영어 등 어떤 언어든 의도 분류 가능. 언어 자체는 #03에서 처리.`;
  }

  protected buildUserMessage(input: IntentClassifierInput): string {
    return `과정 주제: "${input.course_topic}"
학생 질문: "${input.question}"
${input.conversation_summary ? `\n이전 대화 요약: ${input.conversation_summary}` : ""}

위 학생이 듣고 있는 과정 맥락에서 질문 의도를 분류하세요.
조금이라도 과정과 연관되면 off_topic이 아닌 concept_question 등으로 분류합니다.`;
  }

  protected parseOutput(rawText: string): IntentClassifierOutput {
    return parseJsonSafely<IntentClassifierOutput>(rawText);
  }
}
