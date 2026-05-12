import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCronResult, sendSlackAlert } from "@/lib/notifications/slack";

export const runtime = "nodejs";

const DAILY_THRESHOLD_WARN = 50;
const DAILY_THRESHOLD_HIGH = 100;
const WEEKLY_THRESHOLD_USD = 500;

/**
 * Vercel Cron — 일일 비용 모니터링.
 *
 * 매일 15:00 UTC = 00:00 KST (자정 직후 = 전날 마감 비용 집계).
 * 임계 초과 시 Slack 알림.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 최근 24시간 비용 집계 (service별)
  const { data: dayCosts } = await admin
    .from("cost_log")
    .select("service, cost_usd")
    .gte("created_at", dayStart.toISOString());
  const { data: weekCosts } = await admin
    .from("cost_log")
    .select("service, cost_usd")
    .gte("created_at", weekStart.toISOString());

  const dayTotal = (dayCosts ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const weekTotal = (weekCosts ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);

  const byService: Record<string, number> = {};
  for (const row of dayCosts ?? []) {
    const s = row.service ?? "unknown";
    byService[s] = (byService[s] ?? 0) + (Number(row.cost_usd) || 0);
  }

  const breakdown = Object.entries(byService)
    .sort(([, a], [, b]) => b - a)
    .map(([s, c]) => `• ${s}: $${c.toFixed(2)}`)
    .join("\n");

  // 임계 판정
  let level: "ok" | "warning" | "danger" = "ok";
  let alertTitle: string;
  if (dayTotal >= DAILY_THRESHOLD_HIGH) {
    level = "danger";
    alertTitle = `🚨 일일 비용 한도 임박: $${dayTotal.toFixed(2)} (한도 $${DAILY_THRESHOLD_HIGH})`;
  } else if (dayTotal >= DAILY_THRESHOLD_WARN) {
    level = "warning";
    alertTitle = `⚠️ 일일 비용 주의: $${dayTotal.toFixed(2)} (경고선 $${DAILY_THRESHOLD_WARN})`;
  } else {
    alertTitle = `📊 일일 비용 정상: $${dayTotal.toFixed(2)}`;
  }

  // 임계 초과 시만 Slack 알림 (정상 일은 노이즈 회피)
  if (level !== "ok") {
    await sendSlackAlert({
      title: alertTitle,
      level,
      fields: [
        { title: "24h 합계", value: `$${dayTotal.toFixed(2)}`, short: true },
        { title: "7일 합계", value: `$${weekTotal.toFixed(2)}`, short: true },
        { title: "service별 분포", value: breakdown || "(없음)" },
      ],
      action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app"}/admin/integration`,
      action_label: "통합 대시보드",
    });
  }

  // 주간 임계 별도 알림
  if (weekTotal >= WEEKLY_THRESHOLD_USD) {
    await sendSlackAlert({
      title: `📉 주간 비용 임계 초과: $${weekTotal.toFixed(2)} (한도 $${WEEKLY_THRESHOLD_USD})`,
      level: "warning",
      body: "프로덕션 비용 검토 권장",
    });
  }

  // 정상이어도 결과는 로그
  if (level === "ok") {
    await notifyCronResult({
      job_name: "cost-monitor",
      status: "success",
      summary: `일일 $${dayTotal.toFixed(2)} · 주간 $${weekTotal.toFixed(2)} — 정상`,
    });
  }

  return NextResponse.json({
    day_total_usd: dayTotal,
    week_total_usd: weekTotal,
    by_service: byService,
    level,
    alert_sent: level !== "ok",
  });
}
