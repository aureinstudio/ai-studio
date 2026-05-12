import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, type EmailField } from "@/lib/notifications/email";

export const runtime = "nodejs";

/**
 * Vercel Cron — 매일 09:00 KST = 00:00 UTC.
 * 어제 24h 운영 요약 발송 (본부장 + COO).
 *
 * 포함:
 *   - 활성 학생·신규 가입
 *   - Studio·Cast·Tutor 작업 수
 *   - 비용 합계 (전체 + service별)
 *   - 환각 차단율
 *   - 위험 신호 학생 수
 *   - 차단된 보안 요청
 *   - 진행 중 인시던트
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const dateLabel = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 1) 비용
  const { data: costs } = await admin
    .from("cost_log")
    .select("service, cost_usd")
    .gte("created_at", since);
  const byService: Record<string, number> = {};
  let costTotal = 0;
  for (const r of costs ?? []) {
    const s = r.service ?? "unknown";
    const v = Number(r.cost_usd) || 0;
    byService[s] = (byService[s] ?? 0) + v;
    costTotal += v;
  }
  const costLines = Object.entries(byService)
    .sort(([, a], [, b]) => b - a)
    .map(([s, v]) => `• ${s}: $${v.toFixed(2)}`)
    .join("\n");

  // 2) Studio·Cast·Tutor 작업
  const [{ count: studioCount }, { count: castCount }, { count: tutorMsgCount }] = await Promise.all([
    admin.from("studio_jobs").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("cast_jobs").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("tutor_conversations").select("*", { count: "exact", head: true }).gte("last_active_at", since),
  ]);

  // 3) 환각 차단율 — tutor_conversations.messages에서 verdict=rejected 비율
  // 단순 근사: messages JSONB 전체 스캔은 비쌈 → 24h 평균 응답 시간으로 대체
  const { data: recentConvs } = await admin
    .from("tutor_conversations")
    .select("rejected_count, total_messages")
    .gte("last_active_at", since)
    .limit(500);
  const totalMsgs = (recentConvs ?? []).reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const totalRejected = (recentConvs ?? []).reduce((s, c) => s + (c.rejected_count ?? 0), 0);
  const rejectRate = totalMsgs > 0 ? (totalRejected / totalMsgs) * 100 : 0;

  // 4) 신규 가입
  const { count: newProfiles } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  // 5) 위험 신호 학생 (admin_alerts)
  const { count: alertCount } = await admin
    .from("admin_alerts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  // 6) 보안 — 차단된 입력
  const { count: blockedCount } = await admin
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("blocked", true)
    .gte("created_at", since);

  // 7) 진행 중 인시던트
  const { data: openIncidents } = await admin
    .from("incidents")
    .select("level, title, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const openLines = (openIncidents ?? [])
    .map((i) => `• [${i.level}] ${i.title}`)
    .join("\n") || "(없음)";

  // 8) 헬스 — 1회 ping
  let healthLine = "확인 안 함";
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
    const r = await fetch(`${base}/api/health`, { cache: "no-store" });
    const j = (await r.json()) as { status: string; total_latency_ms: number };
    healthLine = `${j.status} (${j.total_latency_ms}ms)`;
  } catch {}

  const fields: EmailField[] = [
    { title: "신규 가입", value: `${newProfiles ?? 0}명` },
    { title: "활성 대화", value: `${tutorMsgCount ?? 0}건` },
    { title: "Studio 작업", value: `${studioCount ?? 0}건` },
    { title: "Cast 영상", value: `${castCount ?? 0}건` },
    { title: "총 비용", value: `$${costTotal.toFixed(2)}` },
    { title: "서비스별 비용", value: costLines || "(없음)" },
    { title: "환각 차단율", value: `${rejectRate.toFixed(1)}% (${totalRejected}/${totalMsgs})` },
    { title: "위험 신호 학생", value: `${alertCount ?? 0}건` },
    { title: "차단된 입력", value: `${blockedCount ?? 0}건` },
    { title: "진행 중 인시던트", value: openLines },
    { title: "시스템 상태", value: healthLine },
  ];

  await notifyAdmin({
    title: `📊 일일 리포트 ${dateLabel} — 비용 $${costTotal.toFixed(2)}`,
    body: "24시간 운영 요약입니다.",
    fields,
    level: costTotal >= 100 || (alertCount ?? 0) > 0 ? "warning" : "ok",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/integration`,
    action_label: "통합 대시보드 →",
  });

  return NextResponse.json({
    sent: true,
    date: dateLabel,
    cost_usd: costTotal,
    studio: studioCount ?? 0,
    cast: castCount ?? 0,
    tutor: tutorMsgCount ?? 0,
  });
}
