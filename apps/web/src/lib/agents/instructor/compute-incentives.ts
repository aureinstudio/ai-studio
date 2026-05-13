import { createAdminClient } from "@/lib/supabase/admin";
import { calculateIncentive, compositeScore, type InstructorMetricsSnapshot, type IncentiveResult } from "./incentive-calc";

export type ComputedRow = {
  instructor: { id: string; email: string | null; name: string | null };
  metrics: InstructorMetricsSnapshot;
  score: number;
  incentives: IncentiveResult[];
};

export async function computeMonthlyIncentives(period: string): Promise<ComputedRow[]> {
  const periodStart = `${period}-01T00:00:00.000Z`;
  const periodEnd = new Date(new Date(periodStart).getTime() + 32 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10) + "T00:00:00.000Z";

  const admin = createAdminClient();
  const { data: instructors } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("role", "instructor");

  if (!instructors || instructors.length === 0) return [];

  const rows = await Promise.all(
    instructors.map(async (inst) => {
      const [
        { count: reviewCount },
        { data: nps },
        { data: enrollments },
        { count: approvedProposals },
        { count: interventions },
      ] = await Promise.all([
        admin.from("sme_evaluations").select("id", { count: "exact", head: true })
          .eq("evaluator_id", inst.id).gte("created_at", periodStart).lt("created_at", periodEnd),
        admin.from("nps_responses").select("score")
          .gte("created_at", periodStart).lt("created_at", periodEnd),
        admin.from("student_enrollments").select("status")
          .gte("enrolled_at", periodStart).lt("enrolled_at", periodEnd),
        admin.from("instructor_content_proposals").select("id", { count: "exact", head: true })
          .eq("instructor_id", inst.id).eq("status", "approved")
          .gte("reviewed_at", periodStart).lt("reviewed_at", periodEnd),
        admin.from("admin_alerts").select("id", { count: "exact", head: true })
          .eq("acknowledged_by", inst.id).gte("created_at", periodStart).lt("created_at", periodEnd),
      ]);

      const npsScores = (nps ?? []).map((r) => r.score as number);
      const promoters = npsScores.filter((s) => s >= 9).length;
      const detractors = npsScores.filter((s) => s <= 6).length;
      const npsValue = npsScores.length > 0 ? ((promoters - detractors) / npsScores.length) * 100 : 0;

      const enrolled = enrollments ?? [];
      const completed = enrolled.filter((e) => e.status === "completed").length;
      const completionRate = enrolled.length > 0 ? (completed / enrolled.length) * 100 : 0;

      const metrics: InstructorMetricsSnapshot = {
        ai_usage_pct: Math.min(100, (reviewCount ?? 0) * 5),
        student_nps: Math.round(npsValue),
        completion_rate: Math.round(completionRate),
        content_review_count: reviewCount ?? 0,
        risk_intervention_count: interventions ?? 0,
        score_improvement: 0,
        approved_proposals: approvedProposals ?? 0,
      };

      return {
        instructor: { id: inst.id, email: inst.email, name: inst.name },
        metrics,
        score: compositeScore(metrics),
      };
    }),
  );

  rows.sort((a, b) => b.score - a.score);
  const topDecileThreshold = Math.max(1, Math.floor(rows.length * 0.1));
  const topIds = new Set(rows.slice(0, topDecileThreshold).map((r) => r.instructor.id));

  return rows.map((r) => ({
    ...r,
    incentives: calculateIncentive(r.metrics, topIds.has(r.instructor.id)),
  }));
}
