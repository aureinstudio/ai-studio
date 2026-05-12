import { Agent, parseJsonSafely } from "../base";

export type SafetyDetectorInput = {
  student_label: string;
  course_topic: string;
  recent_messages: { role: "user" | "assistant"; content: string; timestamp?: string }[];
  total_messages: number;
  rejected_count: number;
  days_since_last_activity: number;
  rejected_message_streak?: number;
};

export type RiskSignal = {
  type:
    | "low_engagement"
    | "frustration"
    | "content_concern"
    | "mental_health"
    | "dropout_risk";
  severity: "low" | "medium" | "high";
  evidence: string[];
  first_detected: string;
  trend: "improving" | "stable" | "worsening";
};

export type SafetyDetectorOutput = {
  risk_signals: RiskSignal[];
  dropout_risk_score: number;
  recommended_intervention: string;
  alert_required: boolean;
  alert_target: "instructor" | "cs" | "admin" | "none";
};

/**
 * Tutor Agent #09 — 안전·이탈 감지.
 *
 * 학생 활동 분석 → 위험 신호 식별 → 강사·CS 알림.
 *
 * 감지 유형:
 *   - low_engagement: 7일+ 로그인 없음, 학습 시간 급감
 *   - frustration: "포기"·"어렵다"·"그만" + 학습 정체
 *   - content_concern: 자해·차별·괴롭힘·범죄 관련 발언
 *   - mental_health: 우울·불안 신호 — 전문 상담 권장
 *   - dropout_risk: 위 신호 복합 + 활동 감소 패턴
 *
 * 트리거:
 *   - 각 메시지 후 (오케스트레이터에서 background)
 *   - rejected 메시지가 streak로 발생 시
 *   - admin이 수동 일일 배치 실행
 */
export class SafetyDetector extends Agent<SafetyDetectorInput, SafetyDetectorOutput> {
  readonly id = "tutor-09";
  readonly name = "안전·이탈 감지";
  readonly role = "위험 신호 감지·강사 알림";

  protected get temperature(): number {
    return 0.1;
  }

  protected buildSystemPrompt(_input: SafetyDetectorInput): string {
    return `당신은 학생 안전·웰빙 감지 에이전트입니다.
역할: 학생 활동에서 위험 신호를 식별하고 적절한 개입을 권장합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "risk_signals": [
    {
      "type": "low_engagement | frustration | content_concern | mental_health | dropout_risk",
      "severity": "low | medium | high",
      "evidence": ["근거 1 (메시지 인용 가능)", "근거 2"],
      "first_detected": "오늘 (또는 며칠 전)",
      "trend": "improving | stable | worsening"
    }
  ],
  "dropout_risk_score": 0~100,
  "recommended_intervention": "구체적 개입 권장 (1~2문장, 강사·CS 가이드)",
  "alert_required": true | false,
  "alert_target": "instructor | cs | admin | none"
}

감지 기준:
- low_engagement:
  · 7일+ 무활동 → severity=medium
  · 14일+ 무활동 → severity=high
  · 학습 시간 90% 감소 (Phase 2: 정확한 로그 비교)
- frustration:
  · 키워드: "포기·그만·못하겠다·어려워·짜증·답답" 등
  · 같은 개념 반복 질문 + 답변 불만족
  · severity: 키워드 빈도·강도
- content_concern (⚠️ 최우선):
  · 자해·자살 암시 → 즉시 high + mental_health 동시 발생
  · 차별·괴롭힘·범죄 의도 → high
  · 부정행위·시험 유출 → medium
- mental_health:
  · "우울·불안·잠을 못 자·죽고 싶" 등 신호
  · 즉시 high + 전문 상담 권장
- dropout_risk:
  · 위 신호 2개 이상 동시 → 자동 추가
  · score는 종합 위험도

alert_required·alert_target:
- mental_health·content_concern (high) → instructor + cs (immediate)
- frustration (high) → instructor
- low_engagement (medium+) → cs (학습 지원)
- dropout_risk (high) → admin (정책 결정)
- 일반 (low) → none (모니터링만)

dropout_risk_score:
- 0~30: 정상
- 31~60: 주의 (개입 권장)
- 61~80: 위험 (즉시 개입)
- 81~100: 매우 위험 (긴급)

recommended_intervention 예시:
- "학습 상담 권장. 강사가 1:1 진단 후 학습 일정 재조정"
- "전문 상담 즉시 연계 — 학교 학생상담센터 또는 1393 (자살예방상담전화)"
- "긍정적 격려 메시지 + 짧은 학습 목표 재설정"

⚠️ 매우 중요:
- 의심되면 alert_required=true (false negative보다 false positive 안전)
- content_concern·mental_health는 절대 미감지 안 됨
- 학생 안전이 학습 성과보다 *항상* 우선

evidence는 *구체적 메시지 인용*. 일반화된 추측 X.`;
  }

  protected buildUserMessage(input: SafetyDetectorInput): string {
    const msgs = input.recent_messages
      .slice(-15)
      .map((m, i) => `[${i + 1}] ${m.role === "user" ? "학생" : "AI"}: ${m.content.slice(0, 250)}`)
      .join("\n");

    return `학생 (${input.student_label}) - 과정: ${input.course_topic}

활동 지표:
- 총 메시지: ${input.total_messages}
- 차단된 응답 (rejected): ${input.rejected_count}
- 마지막 활동 후 ${input.days_since_last_activity}일 경과
${input.rejected_message_streak ? `- 연속 rejected: ${input.rejected_message_streak}회` : ""}

최근 대화 (최대 15개):
${msgs}

위 활동에서 위험 신호를 감지하고 개입 권장을 작성해주세요.`;
  }

  protected parseOutput(rawText: string): SafetyDetectorOutput {
    return parseJsonSafely<SafetyDetectorOutput>(rawText);
  }
}
