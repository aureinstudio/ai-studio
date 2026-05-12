import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SafetyDetector } from "@/lib/agents/tutor/safety-detector";
import { logCost } from "@/lib/cost-tracker";
import { notifyAdminAlert } from "@/lib/notifications/slack";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  conversation_id: z.string().uuid(),
});

/**
 * POST /api/tutor/safety-check
 *
 * 특정 대화 → #09 SafetyDetector → admin_alerts에 위험 신호 저장.
 *
 * 트리거:
 *   - orchestrator-v1이 위험 메시지 후 자동 호출
 *   - admin이 수동 배치 (모든 활성 대화)
 *   - Phase 2: Vercel Cron 일일 자동
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("tutor_conversations")
    .select(
      "id, student_id, studio_job_id, messages, total_messages, rejected_count, last_active_at",
    )
    .eq("id", parsed.data.conversation_id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });

  // 권한: 본인 또는 admin
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (!isAdmin && conv.student_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: job } = await admin
    .from("studio_jobs")
    .select("topic")
    .eq("id", conv.studio_job_id)
    .maybeSingle();

  const daysSince = conv.last_active_at
    ? Math.floor(
        (Date.now() - new Date(conv.last_active_at).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  try {
    const detector = new SafetyDetector();
    const r09 = await detector.execute({
      student_label: `student-${conv.student_id.slice(0, 8)}`,
      course_topic: job?.topic ?? "(미상)",
      recent_messages: (conv.messages ?? []) as { role: "user" | "assistant"; content: string }[],
      total_messages: conv.total_messages ?? 0,
      rejected_count: conv.rejected_count ?? 0,
      days_since_last_activity: daysSince,
    });
    await logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/safety-check",
      userId: user.id,
      tokensIn: r09.log.tokens_in,
      tokensOut: r09.log.tokens_out,
      costUsd: r09.log.cost_usd,
      metadata: { stage: "safety", conversation_id: parsed.data.conversation_id },
    });

    const alertsCreated: string[] = [];
    if (r09.output.alert_required && r09.output.alert_target !== "none") {
      for (const signal of r09.output.risk_signals) {
        const { data: alert } = await admin
          .from("admin_alerts")
          .insert({
            alert_type: signal.type,
            severity: signal.severity,
            student_id: conv.student_id,
            source_conversation_id: conv.id,
            evidence: { items: signal.evidence, trend: signal.trend, first_detected: signal.first_detected },
            recommended_intervention: r09.output.recommended_intervention,
            alert_target: r09.output.alert_target,
            dropout_risk_score: r09.output.dropout_risk_score,
          })
          .select("id")
          .single();
        if (alert?.id) alertsCreated.push(alert.id);
        // Slack 알림 (medium·high만)
        await notifyAdminAlert({
          alert_type: signal.type,
          severity: signal.severity,
          student_label: conv.student_id.slice(0, 8),
          evidence: signal.evidence,
          intervention: r09.output.recommended_intervention,
          dropout_risk: r09.output.dropout_risk_score,
        });
      }
    }

    return NextResponse.json({
      result: r09.output,
      alerts_created: alertsCreated.length,
      cost_usd: r09.log.cost_usd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tutor/safety-check] failed:", err);
    return NextResponse.json(
      { error: "safety_check_failed", detail: message },
      { status: 500 },
    );
  }
}
