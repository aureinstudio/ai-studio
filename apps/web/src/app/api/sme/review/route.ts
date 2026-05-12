import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/notifications/email";

export const runtime = "nodejs";

const schema = z.object({
  studio_job_id: z.string().uuid(),
  accuracy_score: z.number().int().min(1).max(5),
  suitability_score: z.number().int().min(1).max(5),
  exam_alignment_score: z.number().int().min(1).max(5),
  improvements: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "sme" && profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const avg = (parsed.data.accuracy_score + parsed.data.suitability_score + parsed.data.exam_alignment_score) / 3;
  const ratingFromTriple = Math.round(avg) as 1 | 2 | 3 | 4 | 5;

  // 기존 평가 갱신 또는 새로 INSERT
  const { data: existing } = await admin
    .from("sme_evaluations")
    .select("id")
    .eq("studio_job_id", parsed.data.studio_job_id)
    .eq("evaluator_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("sme_evaluations")
      .update({
        rating: ratingFromTriple,
        accuracy_score: parsed.data.accuracy_score,
        suitability_score: parsed.data.suitability_score,
        exam_alignment_score: parsed.data.exam_alignment_score,
        improvements: parsed.data.improvements ?? null,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("sme_evaluations").insert({
      studio_job_id: parsed.data.studio_job_id,
      rating: ratingFromTriple,
      accuracy_score: parsed.data.accuracy_score,
      suitability_score: parsed.data.suitability_score,
      exam_alignment_score: parsed.data.exam_alignment_score,
      improvements: parsed.data.improvements ?? null,
      evaluator_id: user.id,
      evaluator_name: profile?.name ?? null,
      evaluator_role: profile?.role ?? null,
    });
  }

  // 합격선 미달 (avg < 4.0) → 본부장 알림 + 보완 큐 자동 등록
  if (avg < 4.0) {
    const { data: job } = await admin
      .from("studio_jobs")
      .select("topic")
      .eq("id", parsed.data.studio_job_id)
      .maybeSingle();

    // 보완 큐 — 같은 job·pending 중복 회피
    const { data: existingQ } = await admin
      .from("content_remediation_queue")
      .select("id")
      .eq("studio_job_id", parsed.data.studio_job_id)
      .eq("status", "pending")
      .maybeSingle();
    if (!existingQ) {
      await admin.from("content_remediation_queue").insert({
        studio_job_id: parsed.data.studio_job_id,
        reason: "sme_fail_avg_lt_4.0",
        avg_score: Number(avg.toFixed(2)),
        improvements: parsed.data.improvements ?? null,
        triggered_by: user.id,
      });
    }
    await notifyAdmin({
      title: `⚠ SME 합격선 미달 — "${job?.topic ?? "(미상)"}" 평균 ${avg.toFixed(1)}/5`,
      body: parsed.data.improvements ?? "(개선 의견 없음)",
      fields: [
        { title: "정확성", value: `${parsed.data.accuracy_score}/5` },
        { title: "학습자 적합성", value: `${parsed.data.suitability_score}/5` },
        { title: "시험 부합도", value: `${parsed.data.exam_alignment_score}/5` },
        { title: "SME", value: profile?.name ?? user.id.slice(0, 8) },
      ],
      level: "warning",
      action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/sme/review/${parsed.data.studio_job_id}`,
      action_label: "검토 보기 →",
    });
  }

  return NextResponse.json({ ok: true, avg, passed: avg >= 4.0 });
}
