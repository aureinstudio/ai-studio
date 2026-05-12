import { Agent, parseJsonSafely } from "../base";

export type ComprehensionInput = {
  student_label: string; // 익명 식별 (이메일 앞부분 등)
  course_topic: string;
  conversation_summary: string;
  total_messages: number;
  rejected_count: number;
  // 최근 N턴 (역할 + 내용)
  recent_messages: { role: "user" | "assistant"; content: string }[];
};

export type ChapterUnderstanding = {
  chapter: string;
  score: number;
  evidence: string[];
  weak_concepts: string[];
};

export type ComprehensionOutput = {
  overall_understanding: number;
  by_chapter: ChapterUnderstanding[];
  weak_concepts: string[];
  learning_style_observations: string;
  recommended_focus_areas: string[];
  estimated_exam_readiness: number;
  trend: "improving" | "stable" | "declining";
};

/**
 * Tutor Agent #05 — 이해도 평가.
 *
 * 학생의 Tutor 대화·질문 패턴 → 이해도 점수.
 * (Quiz·진도 시스템 미빌드 — 현재는 대화 분석만)
 *
 * 트리거:
 *   - 학생이 평가 요청 시 (POST /api/tutor/evaluate)
 *   - 대화 10턴마다 자동 (Phase 2)
 */
export class ComprehensionEvaluator extends Agent<
  ComprehensionInput,
  ComprehensionOutput
> {
  readonly id = "tutor-05";
  readonly name = "이해도 평가";
  readonly role = "학생 이해도·약점 영역 분석";

  protected get temperature(): number {
    return 0.2;
  }

  protected buildSystemPrompt(_input: ComprehensionInput): string {
    return `당신은 이해도 평가 에이전트입니다.
역할: 학생의 Tutor 대화를 분석하여 이해도와 약점을 평가합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "overall_understanding": 0~100,
  "by_chapter": [
    {
      "chapter": "챕터 제목 또는 주제",
      "score": 0~100,
      "evidence": ["판단 근거 1", "근거 2"],
      "weak_concepts": ["약한 개념 1"]
    }
  ],
  "weak_concepts": ["전반 약점 1", "약점 2"],
  "learning_style_observations": "학습 스타일 관찰 (1~2문장)",
  "recommended_focus_areas": ["집중해야 할 영역 1", "영역 2"],
  "estimated_exam_readiness": 0~100,
  "trend": "improving | stable | declining"
}

평가 기준:
- overall_understanding:
  · 80+: 핵심 개념 명확히 이해, 응용 질문 시도
  · 60~79: 기본 이해 완료, 일부 심화 부족
  · 40~59: 기초 흔들림, 반복 학습 필요
  · 40 미만: 처음부터 다시
- evidence: 구체적 대화 내용 인용
- weak_concepts: 학생이 *반복적으로 혼동·오해*하는 개념
- learning_style:
  · "암기 의존형" / "원리 이해형" / "예시 중심형" / "체계적" 등
- estimated_exam_readiness: 시험 준비도 (overall과 다를 수 있음 — 시험 형식·암기량 고려)
- trend:
  · improving: 최근 질문이 더 깊어지거나 정확함
  · stable: 비슷한 수준 유지
  · declining: 좌절·기초 질문 반복

주의:
- rejected_count 많으면 학생이 안전·범위 외 질문을 자주 한다는 의미 — 학습 흥미 약화 신호 가능
- 한국어 출력`;
  }

  protected buildUserMessage(input: ComprehensionInput): string {
    const msgs = input.recent_messages
      .slice(-20)
      .map((m, i) => `[${i + 1}] ${m.role === "user" ? "Q" : "A"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    return `학생 (${input.student_label}) - 과정: ${input.course_topic}

활동 요약:
- 총 메시지: ${input.total_messages}
- 차단된 응답 (rejected): ${input.rejected_count}

이전 대화 요약: ${input.conversation_summary || "없음"}

최근 대화 (최대 20개):
${msgs}

위 대화를 분석하여 학생의 이해도·약점·학습 스타일을 평가해주세요.`;
  }

  protected parseOutput(rawText: string): ComprehensionOutput {
    return parseJsonSafely<ComprehensionOutput>(rawText);
  }
}
