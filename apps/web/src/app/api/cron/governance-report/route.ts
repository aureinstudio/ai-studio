import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, type EmailField } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron — 매주 월요일 08:00 KST = 일 23:00 UTC.
 * 지난 7일 KPI + 부서별 비용 + 위임 비율 + 이슈 → governance_reports에 저장 + 임원 이메일.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 86400_000).toISOString();

  // ISO 주차
  const isoWeek = (() => {
    const d = new Date(now);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const w = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
  })();

  // 1. 7일 KPI
  const [
    { count: newSignups },
    { count: activeStudents },
    { count: studioJobs },
    { count: castJobs },
    { data: costs },
    { data: convs },
    { data: alertsNew },
    { data: incidents },
    { count: nps7d },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user").gte("last_seen_at", since7d),
    admin.from("studio_jobs").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    admin.from("cast_jobs").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    admin.from("cost_log").select("cost_usd, service").gte("created_at", since7d),
    admin.from("tutor_conversations").select("total_messages, rejected_count").gte("last_active_at", since7d),
    admin.from("admin_alerts").select("severity, alert_type").gte("created_at", since7d),
    admin.from("incidents").select("level, category, resolved_at").gte("created_at", since7d),
    admin.from("nps_responses").select("*", { count: "exact", head: true }).gte("created_at", since7d),
  ]);

  const totalCost = (costs ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const byService: Record<string, number> = {};
  for (const r of costs ?? []) {
    const k = r.service ?? "unknown";
    byService[k] = (byService[k] ?? 0) + (Number(r.cost_usd) || 0);
  }
  const tutorMsgs = (convs ?? []).reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const tutorRej = (convs ?? []).reduce((s, c) => s + (c.rejected_count ?? 0), 0);
  const highSev = (alertsNew ?? []).filter((a) => a.severity === "high").length;
  const l3Plus = (incidents ?? []).filter((i) => i.level === "L3" || i.level === "L4").length;

  const payload = {
    week_iso: isoWeek,
    generated_at: now.toISOString(),
    kpis: {
      new_signups: newSignups ?? 0,
      active_students: activeStudents ?? 0,
      studio_jobs: studioJobs ?? 0,
      cast_jobs: castJobs ?? 0,
      tutor_messages: tutorMsgs,
      tutor_reject_rate: tutorMsgs > 0 ? Number(((tutorRej / tutorMsgs) * 100).toFixed(1)) : 0,
      nps_responses: nps7d ?? 0,
    },
    cost: {
      total_usd: Number(totalCost.toFixed(2)),
      by_service: Object.fromEntries(
        Object.entries(byService).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
    },
    alerts_severity: {
      high: highSev,
      medium: (alertsNew ?? []).filter((a) => a.severity === "medium").length,
    },
    incidents: {
      total: incidents?.length ?? 0,
      l3_plus: l3Plus,
      unresolved: (incidents ?? []).filter((i) => !i.resolved_at).length,
    },
  };

  // 저장 (idempotent — 같은 주차 재실행 시 overwrite)
  await admin
    .from("governance_reports")
    .upsert({ week_iso: isoWeek, payload, generated_at: now.toISOString() });

  // 임원 이메일
  const fields: EmailField[] = [
    { title: "신규 가입", value: `${payload.kpis.new_signups}명` },
    { title: "활성 학생 (7일)", value: `${payload.kpis.active_students}명` },
    { title: "Studio·Cast", value: `${payload.kpis.studio_jobs} / ${payload.kpis.cast_jobs}건` },
    { title: "Tutor 메시지·차단율", value: `${payload.kpis.tutor_messages.toLocaleString()} (${payload.kpis.tutor_reject_rate}%)` },
    { title: "NPS 응답", value: `${payload.kpis.nps_responses}건` },
    { title: "주간 비용", value: `$${payload.cost.total_usd}` },
    {
      title: "서비스별 비용",
      value: Object.entries(payload.cost.by_service)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `• ${k}: $${v}`)
        .join("\n") || "(없음)",
    },
    { title: "위험 알림 (high)", value: `${payload.alerts_severity.high}건` },
    { title: "L3+ 인시던트", value: `${payload.incidents.l3_plus}건` },
  ];

  const level = highSev > 0 || l3Plus > 0 ? "warning" : "ok";
  await notifyAdmin({
    title: `📊 주간 거버넌스 보고서 ${isoWeek}`,
    body: "지난 7일 전사 운영 요약입니다.",
    fields,
    level,
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/executive`,
    action_label: "경영 대시보드 →",
  });

  return NextResponse.json({ ok: true, week_iso: isoWeek, payload });
}
