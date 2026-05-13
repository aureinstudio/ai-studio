import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/g3-final-report?save=1
 *
 * 14주 누적 KPI + 5 가설 평가 + 5 카테고리 ROI + 본부장 의존도 추이 +
 * 인시던트·환각 통계 + 자유 서술 — 한 번에 집계.
 * ?save=1 이면 g3_reports에 영구 저장.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date();
  const start14w = new Date(now.getTime() - 14 * 7 * 86400_000).toISOString();

  // 1) 누적 KPI
  const [
    { count: studentCount },
    { count: instructorCount },
    { data: studioJobs },
    { data: castJobs },
    { data: tutorConvs },
    { data: nps },
    { data: enrollments },
    { data: costLog },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "instructor"),
    admin.from("studio_jobs").select("id, status, course_category, cost_usd, created_at").gte("created_at", start14w),
    admin.from("cast_jobs").select("id, status, cost_usd").gte("created_at", start14w),
    admin.from("tutor_conversations").select("id, total_messages, rejected_count").gte("created_at", start14w),
    admin.from("nps_responses").select("score, studio_job_id, created_at").gte("created_at", start14w),
    admin.from("student_enrollments").select("id, studio_job_id, status, enrolled_at, completed_at").gte("enrolled_at", start14w),
    admin.from("cost_log").select("service, cost_usd, created_at").gte("created_at", start14w),
  ]);

  const npsScores = (nps ?? []).map((r) => r.score as number);
  const promoters = npsScores.filter((s) => s >= 9).length;
  const detractors = npsScores.filter((s) => s <= 6).length;
  const npsValue = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;

  const completion = (enrollments ?? []).length === 0 ? 0 :
    Math.round(((enrollments ?? []).filter((e) => e.status === "completed").length / enrollments!.length) * 100);

  const totalCostUsd = ((studioJobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0))
    + ((castJobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0))
    + ((costLog ?? []).reduce((s, l) => s + Number(l.cost_usd ?? 0), 0));

  const kpi_snapshot = {
    period_weeks: 14,
    students: studentCount ?? 0,
    instructors: instructorCount ?? 0,
    studio_jobs_total: (studioJobs ?? []).length,
    studio_jobs_completed: (studioJobs ?? []).filter((j) => j.status === "completed").length,
    cast_jobs_total: (castJobs ?? []).length,
    tutor_conversations: (tutorConvs ?? []).length,
    tutor_messages: (tutorConvs ?? []).reduce((s, c) => s + Number(c.total_messages ?? 0), 0),
    tutor_rejected: (tutorConvs ?? []).reduce((s, c) => s + Number(c.rejected_count ?? 0), 0),
    nps: npsValue,
    completion_rate_pct: completion,
    total_cost_usd: Math.round(totalCostUsd * 100) / 100,
  };

  // 2) 5 가설 Final 평가
  const { data: hypothesisRows } = await admin
    .from("hypothesis_metrics")
    .select("hypothesis_id, value, captured_at")
    .gte("captured_at", start14w)
    .order("captured_at", { ascending: false });

  const byHypothesis: Record<string, number[]> = {};
  for (const r of hypothesisRows ?? []) {
    (byHypothesis[r.hypothesis_id] ??= []).push(Number(r.value));
  }
  const hypothesis_evaluation = Object.entries(byHypothesis).map(([id, vs]) => ({
    hypothesis_id: id,
    latest: vs[0] ?? 0,
    earliest: vs[vs.length - 1] ?? 0,
    samples: vs.length,
    delta: (vs[0] ?? 0) - (vs[vs.length - 1] ?? 0),
  }));

  // 3) 5 카테고리 ROI
  const byCategory: Record<string, { count: number; cost: number }> = {};
  for (const j of studioJobs ?? []) {
    const c = (j.course_category as string) ?? "certification";
    byCategory[c] ??= { count: 0, cost: 0 };
    byCategory[c].count += 1;
    byCategory[c].cost += Number(j.cost_usd ?? 0);
  }
  const category_roi = Object.entries(byCategory).map(([k, v]) => ({
    category: k,
    job_count: v.count,
    cost_usd: Math.round(v.cost * 100) / 100,
    avg_cost_usd: v.count > 0 ? Math.round((v.cost / v.count) * 100) / 100 : 0,
  }));

  // 4) 본부장 의존도 추이 — 주별 admin vs other action ratio
  const { data: activity } = await admin
    .from("team_activity_log")
    .select("actor_id, created_at, profiles!team_activity_log_actor_id_fkey(role)")
    .gte("created_at", start14w);

  const weekly: Record<string, { admin: number; other: number }> = {};
  for (const a of activity ?? []) {
    const wk = new Date(a.created_at).toISOString().slice(0, 10);
    const week = wk.slice(0, 7) + "-W" + Math.ceil(new Date(a.created_at).getDate() / 7);
    weekly[week] ??= { admin: 0, other: 0 };
    const r = Array.isArray(a.profiles) ? a.profiles[0]?.role : (a.profiles as { role?: string } | null)?.role;
    if (r === "admin") weekly[week].admin += 1;
    else weekly[week].other += 1;
  }
  const founder_dependency_trend = Object.entries(weekly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => {
      const total = v.admin + v.other;
      return { week, admin_ratio_pct: total > 0 ? Math.round((v.admin / total) * 100) : 0 };
    });

  // 5) 인시던트·환각
  const [{ count: incidentCount }, { count: hallucinationCount }] = await Promise.all([
    admin.from("incidents").select("id", { count: "exact", head: true }).gte("created_at", start14w),
    admin.from("tutor_conversations").select("id", { count: "exact", head: true }).gt("rejected_count", 0).gte("created_at", start14w),
  ]);

  const incident_stats = {
    incidents_total: incidentCount ?? 0,
    conversations_with_hallucination_block: hallucinationCount ?? 0,
    hallucination_block_rate_pct: (tutorConvs ?? []).length > 0
      ? Math.round(((hallucinationCount ?? 0) / tutorConvs!.length) * 100)
      : 0,
  };

  // 6) 자유 서술 정리
  const [{ data: studentFb }, { data: smeFb }, { data: instructorFb }] = await Promise.all([
    admin.from("student_feedback").select("rating, comment, created_at").gte("created_at", start14w).limit(50),
    admin.from("sme_evaluations").select("notes, created_at").gte("created_at", start14w).not("notes", "is", null).limit(30),
    admin.from("instructor_nps").select("comments, recommend_score, period").not("comments", "is", null).limit(30),
  ]);

  const qualitative_summary = {
    student_feedback_count: (studentFb ?? []).length,
    student_avg_rating: (studentFb ?? []).length > 0
      ? Math.round(((studentFb ?? []).reduce((s, f) => s + Number(f.rating ?? 0), 0) / studentFb!.length) * 10) / 10
      : 0,
    sme_notes_count: (smeFb ?? []).length,
    instructor_nps_responses: (instructorFb ?? []).length,
    instructor_avg_recommend: (instructorFb ?? []).length > 0
      ? Math.round(((instructorFb ?? []).reduce((s, f) => s + Number(f.recommend_score ?? 0), 0) / instructorFb!.length) * 10) / 10
      : 0,
    student_samples: (studentFb ?? []).slice(0, 10).map((f) => ({ rating: f.rating, comment: f.comment })),
    instructor_samples: (instructorFb ?? []).slice(0, 10).map((f) => ({ score: f.recommend_score, comment: f.comments })),
  };

  const report = {
    kpi_snapshot,
    hypothesis_evaluation,
    category_roi,
    founder_dependency_trend,
    incident_stats,
    qualitative_summary,
    generated_at: new Date().toISOString(),
  };

  // 저장 옵션
  const save = new URL(request.url).searchParams.get("save") === "1";
  if (save) {
    await admin.from("g3_reports").insert({
      generated_by: user.id,
      kpi_snapshot,
      hypothesis_evaluation,
      category_roi,
      founder_dependency_trend,
      incident_stats,
      qualitative_summary,
      raw_payload: report,
    });
  }

  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
