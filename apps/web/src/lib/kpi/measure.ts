/**
 * Gate G2 5개 가설 KPI 측정 함수.
 *
 *   H1 — 제작 효율:  studio_jobs.duration_seconds 평균.  목표 < 300s (5분)
 *   H2 — 품질 유지:  sme_evaluations 종합 평균.           목표 ≥ 4.0 / 5
 *   H3 — 강사 수용:  instructor_usage_reports.used_studio_content 비율. 목표 ≥ 70%
 *   H4 — 다국어:    NPS (segment='multilingual'), tutor 만족 평균. 목표 NPS ≥ 50
 *   H5 — 학습 효과: tutor 사용 학생 평균 활성 점수.       목표 +10pp 이상
 *                  (베타 단계: A/B 없음 → 자가 진단 만족도로 대체)
 *
 * 각 함수는 { value, sample_size, passed, metadata } 반환.
 * cron이 매일 hypothesis_metrics에 1행씩 누적.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type HypothesisId = "H1" | "H2" | "H3" | "H4" | "H5";

export type KpiResult = {
  hypothesis_id: HypothesisId;
  metric_name: string;
  value: number | null;
  sample_size: number;
  passed: boolean;
  target_label: string;
  metadata?: Record<string, unknown>;
};

const TARGETS = {
  H1_DURATION_SEC: 300,
  H2_AVG_RATING: 4.0,
  H3_USAGE_RATIO: 0.7,
  H4_NPS: 50,
  H5_SATISFACTION: 4.0,
} as const;

export async function measureH1(supabase: SupabaseClient): Promise<KpiResult> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from("studio_jobs")
    .select("duration_seconds")
    .eq("status", "completed")
    .gte("created_at", since30d)
    .not("duration_seconds", "is", null);
  const arr = (data ?? []).map((r) => Number(r.duration_seconds)).filter((n) => n > 0);
  const avg = arr.length > 0 ? arr.reduce((s, n) => s + n, 0) / arr.length : null;
  return {
    hypothesis_id: "H1",
    metric_name: "avg_studio_duration_sec",
    value: avg,
    sample_size: arr.length,
    passed: avg !== null && avg < TARGETS.H1_DURATION_SEC,
    target_label: `< ${TARGETS.H1_DURATION_SEC}s (5분)`,
    metadata: { window: "30d", target_sec: TARGETS.H1_DURATION_SEC },
  };
}

export async function measureH2(supabase: SupabaseClient): Promise<KpiResult> {
  // 3축 평균 우선, 미입력 시 rating 사용
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from("sme_evaluations")
    .select("rating, accuracy_score, suitability_score, exam_alignment_score")
    .gte("created_at", since30d);
  const scores: number[] = [];
  for (const r of data ?? []) {
    const triple = [r.accuracy_score, r.suitability_score, r.exam_alignment_score]
      .map(Number)
      .filter((n) => n >= 1 && n <= 5);
    if (triple.length === 3) {
      scores.push(triple.reduce((s, n) => s + n, 0) / 3);
    } else if (r.rating) {
      scores.push(Number(r.rating));
    }
  }
  const avg = scores.length > 0 ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
  return {
    hypothesis_id: "H2",
    metric_name: "avg_sme_rating",
    value: avg,
    sample_size: scores.length,
    passed: avg !== null && avg >= TARGETS.H2_AVG_RATING,
    target_label: `≥ ${TARGETS.H2_AVG_RATING} / 5`,
    metadata: { window: "30d" },
  };
}

export async function measureH3(supabase: SupabaseClient): Promise<KpiResult> {
  // 최근 4주 강사 보고서. used_studio_content=true 비율.
  const since28d = new Date(Date.now() - 28 * 86400_000).toISOString();
  const { data } = await supabase
    .from("instructor_usage_reports")
    .select("used_studio_content")
    .gte("created_at", since28d);
  const rows = data ?? [];
  const used = rows.filter((r) => r.used_studio_content).length;
  const ratio = rows.length > 0 ? used / rows.length : null;
  return {
    hypothesis_id: "H3",
    metric_name: "instructor_adoption_rate",
    value: ratio,
    sample_size: rows.length,
    passed: ratio !== null && ratio >= TARGETS.H3_USAGE_RATIO,
    target_label: `≥ ${TARGETS.H3_USAGE_RATIO * 100}%`,
    metadata: { window: "28d", used_count: used },
  };
}

export async function measureH4(supabase: SupabaseClient): Promise<KpiResult> {
  // 다국어 학생 NPS (segment='multilingual'). 최근 30일.
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from("nps_responses")
    .select("score")
    .eq("segment", "multilingual")
    .gte("created_at", since30d);
  const scores = (data ?? []).map((r) => Number(r.score));
  let nps: number | null = null;
  if (scores.length > 0) {
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    nps = ((promoters - detractors) / scores.length) * 100;
  }
  return {
    hypothesis_id: "H4",
    metric_name: "multilingual_nps",
    value: nps,
    sample_size: scores.length,
    passed: nps !== null && nps >= TARGETS.H4_NPS,
    target_label: `NPS ≥ ${TARGETS.H4_NPS}`,
    metadata: { window: "30d" },
  };
}

export async function measureH5(supabase: SupabaseClient): Promise<KpiResult> {
  // 베타 단계 — A/B 비교 불가 (모두 Tutor 사용).
  // 대체 측정: 주간 자가 진단 평균 만족도(student_feedback.satisfaction) ≥ 4.0
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from("student_feedback")
    .select("satisfaction")
    .gte("created_at", since30d);
  const scores = (data ?? []).map((r) => Number(r.satisfaction));
  const avg = scores.length > 0 ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
  return {
    hypothesis_id: "H5",
    metric_name: "weekly_satisfaction_avg",
    value: avg,
    sample_size: scores.length,
    passed: avg !== null && avg >= TARGETS.H5_SATISFACTION,
    target_label: `≥ ${TARGETS.H5_SATISFACTION} / 5 (베타 대체)`,
    metadata: { window: "30d", note: "A/B impossible in beta" },
  };
}

export async function measureAll(supabase: SupabaseClient): Promise<KpiResult[]> {
  return Promise.all([
    measureH1(supabase),
    measureH2(supabase),
    measureH3(supabase),
    measureH4(supabase),
    measureH5(supabase),
  ]);
}

/**
 * NPS 전체 (segment 무관) — /admin/g2-readiness 용.
 */
export async function measureOverallNps(supabase: SupabaseClient, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const { data } = await supabase
    .from("nps_responses")
    .select("score")
    .gte("created_at", since);
  const scores = (data ?? []).map((r) => Number(r.score));
  if (scores.length === 0) return { nps: null, sample_size: 0, promoters: 0, detractors: 0, passives: 0 };
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = scores.length - promoters - detractors;
  return {
    nps: ((promoters - detractors) / scores.length) * 100,
    sample_size: scores.length,
    promoters,
    detractors,
    passives,
  };
}
