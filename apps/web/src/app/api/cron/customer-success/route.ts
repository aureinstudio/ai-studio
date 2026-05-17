import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/customer-success
 *
 * 매일 1회 (Vercel cron):
 *   1. 학생 created_at + 30/60/90일 도달 → customer_checkins row 생성
 *   2. 14일 미접속 학생 → low_usage 체크인
 *   3. tenants.contract_end_date - 30/14/7일 → renewal_alerts 생성
 *
 * 실제 메일 발송은 별도 (Resend) — 이 cron은 row 생성만.
 * /admin에서 row를 보고 본부장이 액션.
 */
export async function GET(_request: NextRequest) {
  const admin = createAdminClient();
  const now = new Date();
  const results = { checkins_created: 0, renewals_created: 0 };

  // 1) 30/60/90일 체크인
  for (const days of [30, 60, 90]) {
    const targetStart = new Date(now.getTime() - (days + 1) * 86400_000).toISOString();
    const targetEnd = new Date(now.getTime() - days * 86400_000).toISOString();

    const { data: students } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "user")
      .gte("created_at", targetStart)
      .lt("created_at", targetEnd);

    for (const s of students ?? []) {
      const type = `day_${days}` as "day_30" | "day_60" | "day_90";
      const { error } = await admin.from("customer_checkins").insert({
        user_id: s.id,
        checkin_type: type,
        scheduled_for: now.toISOString(),
        message: `가입 ${days}일 — 사용 경험 체크인`,
      });
      if (!error) results.checkins_created += 1;
    }
  }

  // 2) 14일 미접속 학생 (last_seen_at 기준)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400_000).toISOString();
  const { data: inactive } = await admin
    .from("profiles")
    .select("id, last_seen_at")
    .eq("role", "user")
    .lt("last_seen_at", fourteenDaysAgo);

  for (const s of inactive ?? []) {
    // 중복 방지 — 이미 최근 30일 내 low_usage row 있으면 스킵
    const recentCutoff = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const { count: existing } = await admin
      .from("customer_checkins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", s.id)
      .eq("checkin_type", "low_usage")
      .gte("scheduled_for", recentCutoff);
    if ((existing ?? 0) > 0) continue;

    const { error } = await admin.from("customer_checkins").insert({
      user_id: s.id,
      checkin_type: "low_usage",
      scheduled_for: now.toISOString(),
      message: "14일 이상 미접속 — 학습 재개 안내 필요",
    });
    if (!error) results.checkins_created += 1;
  }

  // 3) 갱신 알림 (tenant 계약 만료 30/14/7일 전)
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, contract_end")
    .eq("status", "active")
    .not("contract_end", "is", null);

  for (const t of tenants ?? []) {
    if (!t.contract_end) continue;
    const endDate = new Date(t.contract_end);
    const daysToEnd = Math.ceil((endDate.getTime() - now.getTime()) / 86400_000);
    let level: "30d" | "14d" | "7d" | "overdue" | null = null;
    if (daysToEnd < 0) level = "overdue";
    else if (daysToEnd <= 7) level = "7d";
    else if (daysToEnd <= 14) level = "14d";
    else if (daysToEnd <= 30) level = "30d";
    if (!level) continue;

    // 중복 방지 — 동일 level alert 미해결 상태면 스킵
    const { count: open } = await admin
      .from("renewal_alerts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t.id)
      .eq("alert_level", level)
      .is("acknowledged_at", null);
    if ((open ?? 0) > 0) continue;

    await admin.from("renewal_alerts").insert({
      tenant_id: t.id,
      contract_end_date: t.contract_end,
      days_to_renewal: daysToEnd,
      alert_level: level,
    });
    results.renewals_created += 1;
  }

  return NextResponse.json({ ok: true, ...results, ran_at: now.toISOString() });
}
