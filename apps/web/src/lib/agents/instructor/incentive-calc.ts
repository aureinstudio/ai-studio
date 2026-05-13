/**
 * 강사 인센티브 자동 계산.
 *
 * 4가지 평가축 → tier 결정:
 *   - basic      : ai 활용도 70%+ → 기본 (보너스 0%)
 *   - excellent  : 학생 NPS 70+   → +10% 보너스
 *   - top        : 다중 지표 상위 10% → +20% + 표창
 *   - content_ip : 신규 콘텐츠 제안 채택 시 → 1회 보너스
 */

export type InstructorMetricsSnapshot = {
  ai_usage_pct: number;          // ai-studio 검토·활용 비율 (0~100)
  student_nps: number;           // 담당 학생 NPS (-100~100)
  completion_rate: number;       // 학생 완주율 (0~100)
  content_review_count: number;  // 콘텐츠 검토 건수
  risk_intervention_count: number; // 위험 학생 개입
  score_improvement: number;     // 평균 점수 향상 (퍼센트포인트)
  approved_proposals: number;    // 채택된 콘텐츠 제안 수
};

export type IncentiveTier = "basic" | "excellent" | "top" | "content_ip";

export type IncentiveResult = {
  tier: IncentiveTier;
  bonus_percent: number;
  amount_krw: number;
  reason: string;
};

const BASE_SALARY_KRW = 3_000_000; // 기본 월급 가정 (실제는 관리자가 조정)
const CONTENT_IP_BONUS_KRW = 500_000;

/**
 * 단일 강사 인센티브 계산.
 * base_salary_krw 미제공 시 기본값 사용 — admin이 instructor별로 override 가능.
 */
export function calculateIncentive(
  metrics: InstructorMetricsSnapshot,
  isTopDecile: boolean,
  baseSalaryKrw: number = BASE_SALARY_KRW,
): IncentiveResult[] {
  const results: IncentiveResult[] = [];

  // 1) 최우수 tier (상위 10%) — 다른 tier와 중복 가능
  if (isTopDecile && metrics.ai_usage_pct >= 70 && metrics.student_nps >= 50) {
    results.push({
      tier: "top",
      bonus_percent: 20,
      amount_krw: Math.round(baseSalaryKrw * 0.2),
      reason: "다중 지표 상위 10% — 사내 표창 대상",
    });
  } else if (metrics.student_nps >= 70) {
    // 2) 우수
    results.push({
      tier: "excellent",
      bonus_percent: 10,
      amount_krw: Math.round(baseSalaryKrw * 0.1),
      reason: `학생 NPS ${metrics.student_nps}점 (≥70)`,
    });
  } else if (metrics.ai_usage_pct >= 70) {
    // 3) 기본 — 자격만 표시 (지급액 0)
    results.push({
      tier: "basic",
      bonus_percent: 0,
      amount_krw: 0,
      reason: `ai-studio 활용도 ${metrics.ai_usage_pct.toFixed(0)}% — 기본 급여 유지`,
    });
  }

  // 4) 콘텐츠 IP 추가 보너스 (중복 지급)
  if (metrics.approved_proposals > 0) {
    results.push({
      tier: "content_ip",
      bonus_percent: 0,
      amount_krw: CONTENT_IP_BONUS_KRW * metrics.approved_proposals,
      reason: `채택된 콘텐츠 제안 ${metrics.approved_proposals}건`,
    });
  }

  return results;
}

/**
 * 종합 점수 — top decile 결정용.
 * 4축 가중 평균:
 *   ai_usage(30) + student_nps(30) + completion(20) + care/quality(20)
 */
export function compositeScore(m: InstructorMetricsSnapshot): number {
  const ai = Math.min(m.ai_usage_pct, 100);
  const nps = Math.max(0, Math.min(100, m.student_nps + 100) / 2); // -100~100 → 0~100
  const compl = Math.min(m.completion_rate, 100);
  const care =
    Math.min(m.risk_intervention_count * 10, 50) +
    Math.min(m.content_review_count * 2, 50);

  return ai * 0.3 + nps * 0.3 + compl * 0.2 + care * 0.2;
}
