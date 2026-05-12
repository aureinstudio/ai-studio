import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SafetyDetector } from "@/lib/agents/tutor/safety-detector";
import { logCost } from "@/lib/cost-tracker";
import { notifyAdmin } from "@/lib/notifications/email";
import { runAutoCareMessages } from "@/lib/care/auto-messages";

export const runtime = "nodejs";
export const maxDuration = 300; // 5분 — 활성 학생 ×3s 평균

/**
 * Vercel Cron — 매일 03:00 KST (18:00 UTC 전일 = 18 18 * * *).
 * 본 라우트는 18:00 UTC schedule로 호출됨 = KST 03:00.
 *
 * 작업:
 *   a) #09 SafetyDetector — 활성 학생(7일 내) 위험 점수 갱신 → admin_alerts INSERT
 *   b) 자동 격려 메시지 (3일 미접속·10h 마일스톤)
 *   c) 어제 KPI 집계 → kpi_metrics
 *   d) 합산 결과 본부장 이메일
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startMs = Date.now();
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 86400_000).toISOString();
  // 어제 일자 (KST 자정 기준) → UTC 18:00 어제 ~ UTC 18:00 오늘. 단순화: UTC 00~24 어제.
  const yest = new Date(now.getTime() - 24 * 3600_000);
  const yestStart = new Date(Date.UTC(yest.getUTCFullYear(), yest.getUTCMonth(), yest.getUTCDate())).toISOString();
  const yestEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const metricDate = yest.toISOString().slice(0, 10);

  // ─── a) 안전 감지 — 7일 내 활성 대화 대상 ──────────
  const { data: activeConvs } = await admin
    .from("tutor_conversations")
    .select("id, student_id, studio_job_id, messages, total_messages, rejected_count, last_active_at")
    .gte("last_active_at", since7d)
    .limit(200); // 베타 규모 안전선

  let safetyChecked = 0;
  let alertsCreated = 0;
  const detector = new SafetyDetector();

  for (const conv of activeConvs ?? []) {
    try {
      const { data: job } = await admin
        .from("studio_jobs")
        .select("topic")
        .eq("id", conv.studio_job_id)
        .maybeSingle();
      const daysSince = conv.last_active_at
        ? Math.floor((Date.now() - new Date(conv.last_active_at).getTime()) / 86400_000)
        : 0;

      const r09 = await detector.execute({
        student_label: `student-${conv.student_id.slice(0, 8)}`,
        course_topic: job?.topic ?? "(미상)",
        recent_messages: (conv.messages ?? []) as { role: "user" | "assistant"; content: string }[],
        total_messages: conv.total_messages ?? 0,
        rejected_count: conv.rejected_count ?? 0,
        days_since_last_activity: daysSince,
      });
      safetyChecked++;
      await logCost({
        supabase: admin,
        service: "tutor",
        endpoint: "/api/cron/daily-tasks",
        userId: conv.student_id,
        tokensIn: r09.log.tokens_in,
        tokensOut: r09.log.tokens_out,
        costUsd: r09.log.cost_usd,
        metadata: { stage: "daily_safety", conversation_id: conv.id },
      });

      if (r09.output.alert_required && r09.output.alert_target !== "none") {
        for (const signal of r09.output.risk_signals) {
          await admin.from("admin_alerts").insert({
            alert_type: signal.type,
            severity: signal.severity,
            student_id: conv.student_id,
            source_conversation_id: conv.id,
            evidence: { items: signal.evidence, trend: signal.trend, first_detected: signal.first_detected },
            recommended_intervention: r09.output.recommended_intervention,
            alert_target: r09.output.alert_target,
            dropout_risk_score: r09.output.dropout_risk_score,
          });
          alertsCreated++;
        }
      }
    } catch (err) {
      console.warn(`[daily-tasks] safety failed for conv ${conv.id}:`, err);
    }
  }

  // ─── b) 자동 격려 ────────────────────────────────
  const care = await runAutoCareMessages(admin).catch((err) => {
    console.warn("[daily-tasks] care messages failed:", err);
    return { inactive3d_sent: 0, milestone_sent: 0 };
  });

  // ─── c) KPI 집계 (어제 자정~오늘 자정 UTC) ────────
  const [
    { count: newSignups },
    { count: studioJobs },
    { count: castJobs },
    { data: yestCosts },
    { count: blockedInputs },
    { data: yestConvs },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true })
      .gte("created_at", yestStart).lt("created_at", yestEnd),
    admin.from("studio_jobs").select("*", { count: "exact", head: true })
      .gte("created_at", yestStart).lt("created_at", yestEnd),
    admin.from("cast_jobs").select("*", { count: "exact", head: true })
      .gte("created_at", yestStart).lt("created_at", yestEnd),
    admin.from("cost_log").select("cost_usd")
      .gte("created_at", yestStart).lt("created_at", yestEnd),
    admin.from("audit_log").select("*", { count: "exact", head: true })
      .eq("blocked", true).gte("created_at", yestStart).lt("created_at", yestEnd),
    admin.from("tutor_conversations").select("total_messages, rejected_count, student_id")
      .gte("last_active_at", yestStart),
  ]);
  const costUsd = (yestCosts ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const tutorMessages = (yestConvs ?? []).reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const tutorRejected = (yestConvs ?? []).reduce((s, c) => s + (c.rejected_count ?? 0), 0);
  const activeStudents = new Set((yestConvs ?? []).map((c) => c.student_id)).size;

  const { count: riskCount } = await admin
    .from("admin_alerts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", yestStart).lt("created_at", yestEnd);

  await admin
    .from("kpi_metrics")
    .upsert({
      metric_date: metricDate,
      active_students: activeStudents,
      new_signups: newSignups ?? 0,
      studio_jobs: studioJobs ?? 0,
      cast_jobs: castJobs ?? 0,
      tutor_messages: tutorMessages,
      tutor_rejected: tutorRejected,
      cost_usd: costUsd,
      risk_signals: riskCount ?? 0,
      blocked_inputs: blockedInputs ?? 0,
    });

  // ─── d) 요약 이메일 (daily-report와 별도 — 새벽 3시 ops 요약) ────────
  await notifyAdmin({
    title: `🌙 야간 자동화 완료 ${metricDate} — 위험 ${alertsCreated} · 격려 ${care.inactive3d_sent + care.milestone_sent}`,
    body: `매일 새벽 3시(KST) 자동 작업 결과입니다.`,
    fields: [
      { title: "안전 검사", value: `${safetyChecked}건 (활성 대화 대상)` },
      { title: "위험 알림 신규", value: `${alertsCreated}건` },
      { title: "3일 격려 발송", value: `${care.inactive3d_sent}명` },
      { title: "10h 마일스톤", value: `${care.milestone_sent}명` },
      { title: "어제 활성 학생", value: `${activeStudents}명` },
      { title: "어제 비용", value: `$${costUsd.toFixed(2)}` },
      { title: "처리 시간", value: `${Math.round((Date.now() - startMs) / 1000)}s` },
    ],
    level: alertsCreated > 0 ? "warning" : "ok",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/at-risk-students`,
    action_label: "위험 학생 확인 →",
  });

  return NextResponse.json({
    ok: true,
    metric_date: metricDate,
    safety_checked: safetyChecked,
    alerts_created: alertsCreated,
    care_messages: care,
    active_students: activeStudents,
    cost_usd: costUsd,
    elapsed_ms: Date.now() - startMs,
  });
}
