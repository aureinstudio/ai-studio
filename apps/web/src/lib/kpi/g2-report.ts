/**
 * Gate G2 Final Report 데이터 집계.
 *
 * 베타 기간(기본 28일) 누적 통계 + 5개 가설 final + 4가지 G2 조건 + 정성 피드백.
 * 단일 함수가 모든 데이터를 합쳐 JSON 반환 — UI/PDF/CSV 모두 동일 소스.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { measureAll, measureOverallNps, type KpiResult } from "./measure";

export type FinalReport = {
  generated_at: string;
  window: { start: string; end: string; days: number };
  totals: {
    total_students: number;
    active_students_7d: number;
    new_signups: number;
    studio_jobs: number;
    cast_jobs: number;
    tutor_messages: number;
    tutor_rejected: number;
    tutor_reject_rate_pct: number;
    cost_usd: number;
    monthly_budget_usd: number;
    budget_used_pct: number;
  };
  hypotheses: KpiResult[];
  hypotheses_passed: number;
  nps: { value: number | null; sample_size: number; promoters: number; passives: number; detractors: number };
  sme: {
    pass_rate_pct: number | null;
    job_count: number;
    passing_jobs: number;
    avg_rating: number | null;
  };
  instructor_adoption_pct: number | null;
  g2_conditions: { key: string; label: string; pass: boolean; detail: string }[];
  g2_pass_count: number;
  recommendation: { decision: "GO" | "HOLD" | "NO-GO"; rationale: string };
  incidents: {
    total: number;
    l3_plus: number;
    open: number;
    by_category: Record<string, number>;
  };
  qualitative: {
    nps_promoter_quotes: string[];
    nps_detractor_quotes: string[];
    sme_improvements: string[];
    self_check_hardest: string[];
  };
};

export async function buildG2FinalReport(
  supabase: SupabaseClient,
  windowDays = 28,
): Promise<FinalReport> {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 86400_000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const since7d = new Date(end.getTime() - 7 * 86400_000).toISOString();
  const sinceMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return d.toISOString(); })();

  // 1) 학생·콘텐츠 카운트
  const [
    { count: totalStudents },
    { count: activeStudents7d },
    { count: newSignups },
    { count: studioJobs },
    { count: castJobs },
    { data: tutorConvs },
    { data: costsWindow },
    { data: costsMonth },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user").gte("last_seen_at", since7d),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user").gte("created_at", startIso),
    supabase.from("studio_jobs").select("*", { count: "exact", head: true }).gte("created_at", startIso),
    supabase.from("cast_jobs").select("*", { count: "exact", head: true }).gte("created_at", startIso),
    supabase.from("tutor_conversations").select("total_messages, rejected_count").gte("last_active_at", startIso),
    supabase.from("cost_log").select("cost_usd").gte("created_at", startIso),
    supabase.from("cost_log").select("cost_usd").gte("created_at", sinceMonth),
  ]);

  const tutorMessages = (tutorConvs ?? []).reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const tutorRejected = (tutorConvs ?? []).reduce((s, c) => s + (c.rejected_count ?? 0), 0);
  const costWindow = (costsWindow ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const costMonth = (costsMonth ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const monthBudget = Number(process.env.COST_GLOBAL_MONTHLY_USD ?? 1000);

  // 2) 가설 5개 + NPS
  const hypotheses = await measureAll(supabase);
  const hypothesesPassed = hypotheses.filter((h) => h.passed).length;
  const npsOverall = await measureOverallNps(supabase, windowDays);

  // 3) SME 합격률
  const { data: smeEvals } = await supabase
    .from("sme_evaluations")
    .select("rating, accuracy_score, suitability_score, exam_alignment_score, studio_job_id, improvements")
    .gte("created_at", startIso);
  const byJob: Record<string, number[]> = {};
  const improvements: string[] = [];
  for (const e of smeEvals ?? []) {
    const triple = [e.accuracy_score, e.suitability_score, e.exam_alignment_score].map(Number).filter((n) => n >= 1);
    const score = triple.length === 3 ? triple.reduce((s, n) => s + n, 0) / 3 : Number(e.rating ?? 0);
    if (score > 0) {
      if (!byJob[e.studio_job_id]) byJob[e.studio_job_id] = [];
      byJob[e.studio_job_id].push(score);
    }
    if (e.improvements && e.improvements.length > 0 && e.improvements.length < 500) {
      improvements.push(e.improvements);
    }
  }
  const jobScores = Object.values(byJob).map((arr) => arr.reduce((s, n) => s + n, 0) / arr.length);
  const passingJobs = jobScores.filter((s) => s >= 4.0).length;
  const smePassRate = jobScores.length > 0 ? (passingJobs / jobScores.length) * 100 : null;
  const smeAvg = jobScores.length > 0 ? jobScores.reduce((s, n) => s + n, 0) / jobScores.length : null;

  // 4) 강사 활용률
  const h3 = hypotheses.find((h) => h.hypothesis_id === "H3");
  const instructorAdoptionPct = h3?.value !== null && h3?.value !== undefined ? Number(h3.value) * 100 : null;

  // 5) G2 4가지 조건
  const g2Conditions = [
    {
      key: "hypos",
      label: "5개 가설 중 4개 이상 통과",
      pass: hypothesesPassed >= 4,
      detail: `${hypothesesPassed} / 5`,
    },
    {
      key: "nps",
      label: "NPS 60 이상",
      pass: npsOverall.nps !== null && npsOverall.nps >= 60,
      detail: npsOverall.nps !== null ? `NPS ${npsOverall.nps.toFixed(1)} (n=${npsOverall.sample_size})` : "표본 부족",
    },
    {
      key: "sme",
      label: "SME 합격선 85% 이상",
      pass: smePassRate !== null && smePassRate >= 85,
      detail: smePassRate !== null ? `${smePassRate.toFixed(1)}% (${passingJobs}/${jobScores.length})` : "평가 부족",
    },
    {
      key: "instructor",
      label: "강사 활용률 70% 이상",
      pass: instructorAdoptionPct !== null && instructorAdoptionPct >= 70,
      detail: instructorAdoptionPct !== null ? `${instructorAdoptionPct.toFixed(1)}% (n=${h3?.sample_size ?? 0})` : "보고 부족",
    },
  ];
  const g2Pass = g2Conditions.filter((c) => c.pass).length;

  // 6) 자동 권장 결정
  let decision: "GO" | "HOLD" | "NO-GO";
  let rationale: string;
  if (g2Pass >= 4) {
    decision = "GO";
    rationale = "4개 G2 조건 모두 충족. Phase 3 SCALE 진입 권장.";
  } else if (g2Pass >= 2) {
    decision = "HOLD";
    const missing = g2Conditions.filter((c) => !c.pass).map((c) => c.label).join(", ");
    rationale = `${g2Pass}/4 조건만 충족. 미달: ${missing}. 2주 보강 후 재평가 권장.`;
  } else {
    decision = "NO-GO";
    rationale = `${g2Pass}/4 조건만 충족. 근본 재설계 필요. Phase 1 회귀 검토.`;
  }

  // 7) 인시던트
  const { data: incidents } = await supabase
    .from("incidents")
    .select("level, category, resolved_at")
    .gte("created_at", startIso);
  const byCategory: Record<string, number> = {};
  for (const i of incidents ?? []) {
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }
  const l3Plus = (incidents ?? []).filter((i) => i.level === "L3" || i.level === "L4").length;
  const openIncidents = (incidents ?? []).filter((i) => !i.resolved_at).length;

  // 8) 정성 데이터
  const { data: npsRows } = await supabase
    .from("nps_responses")
    .select("score, reason")
    .gte("created_at", startIso)
    .not("reason", "is", null);
  const promoterQuotes = (npsRows ?? [])
    .filter((r) => r.score >= 9 && r.reason && r.reason.length > 0)
    .map((r) => r.reason as string)
    .slice(0, 5);
  const detractorQuotes = (npsRows ?? [])
    .filter((r) => r.score <= 6 && r.reason && r.reason.length > 0)
    .map((r) => r.reason as string)
    .slice(0, 5);

  const { data: selfChecks } = await supabase
    .from("student_feedback")
    .select("hardest_part")
    .gte("created_at", startIso)
    .not("hardest_part", "is", null)
    .limit(20);
  const hardestParts = (selfChecks ?? [])
    .map((r) => r.hardest_part as string)
    .filter((s) => s && s.length > 5)
    .slice(0, 5);

  return {
    generated_at: new Date().toISOString(),
    window: { start: startIso, end: endIso, days: windowDays },
    totals: {
      total_students: totalStudents ?? 0,
      active_students_7d: activeStudents7d ?? 0,
      new_signups: newSignups ?? 0,
      studio_jobs: studioJobs ?? 0,
      cast_jobs: castJobs ?? 0,
      tutor_messages: tutorMessages,
      tutor_rejected: tutorRejected,
      tutor_reject_rate_pct: tutorMessages > 0 ? (tutorRejected / tutorMessages) * 100 : 0,
      cost_usd: costWindow,
      monthly_budget_usd: monthBudget,
      budget_used_pct: (costMonth / monthBudget) * 100,
    },
    hypotheses,
    hypotheses_passed: hypothesesPassed,
    nps: {
      value: npsOverall.nps,
      sample_size: npsOverall.sample_size,
      promoters: npsOverall.promoters,
      passives: npsOverall.passives,
      detractors: npsOverall.detractors,
    },
    sme: {
      pass_rate_pct: smePassRate,
      job_count: jobScores.length,
      passing_jobs: passingJobs,
      avg_rating: smeAvg,
    },
    instructor_adoption_pct: instructorAdoptionPct,
    g2_conditions: g2Conditions,
    g2_pass_count: g2Pass,
    recommendation: { decision, rationale },
    incidents: {
      total: incidents?.length ?? 0,
      l3_plus: l3Plus,
      open: openIncidents,
      by_category: byCategory,
    },
    qualitative: {
      nps_promoter_quotes: promoterQuotes,
      nps_detractor_quotes: detractorQuotes,
      sme_improvements: improvements.slice(0, 5),
      self_check_hardest: hardestParts,
    },
  };
}
