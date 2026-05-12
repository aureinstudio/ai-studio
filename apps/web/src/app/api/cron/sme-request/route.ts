import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

/**
 * 매주 월·목 10:00 KST (01:00 UTC).
 * 검토 안 된 최근 콘텐츠 목록을 SME(role='sme') 전원에게 이메일.
 * SME가 0명이면 admin에게 폴백 발송.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // SME 모집
  const { data: smes } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("role", "sme")
    .not("email", "is", null);

  let recipients = (smes ?? []).map((p) => p.email!).filter(Boolean);
  let fallback = false;
  if (recipients.length === 0) {
    // 폴백: admin 이메일
    fallback = true;
    recipients = (process.env.ADMIN_ALERT_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_recipients" });
  }

  // 검토 대기 콘텐츠 — completed studio_jobs 중 sme_evaluations 0건인 것 (최근 14일)
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: jobs } = await admin
    .from("studio_jobs")
    .select("id, topic, created_at")
    .eq("status", "completed")
    .gte("created_at", since14d)
    .order("created_at", { ascending: false })
    .limit(50);

  // 각 job에 sme_evaluations 카운트
  const pending: { id: string; topic: string; created_at: string }[] = [];
  for (const j of jobs ?? []) {
    const { count } = await admin
      .from("sme_evaluations")
      .select("*", { count: "exact", head: true })
      .eq("studio_job_id", j.id);
    if ((count ?? 0) === 0) pending.push(j);
  }

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, pending: 0 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
  const listHtml = pending
    .slice(0, 20)
    .map(
      (j) =>
        `<li style="margin:8px 0;"><a href="${base}/sme/review/${j.id}" style="color:#3b82f6;">${escapeHtml(j.topic)}</a> <span style="color:#71717a;font-size:12px;">${new Date(j.created_at).toLocaleDateString()}</span></li>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">📋 ${pending.length}건 검토 요청</h1>
    <p style="font-size:14px;line-height:1.7;">최근 14일 생성 콘텐츠 중 SME 검토가 없는 항목입니다. 24시간 이내 검토 부탁드립니다.</p>
    <ol style="font-size:14px;line-height:1.7;color:#3b82f6;padding-left:20px;">${listHtml}</ol>
    <p style="margin:20px 0;"><a href="${base}/sme/dashboard" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">SME 대시보드 →</a></p>
    <p style="font-size:12px;color:#71717a;">매주 월·목 자동 발송. 회신·문의는 본부장에게 부탁드립니다.</p>
  </body></html>`;

  await sendEmail({
    to: recipients,
    subject: `[KEG AI Studio] SME 검토 요청 ${pending.length}건`,
    html,
    text: `검토 대기 ${pending.length}건. ${base}/sme/dashboard 에서 확인 부탁드립니다.`,
  });

  return NextResponse.json({
    ok: true,
    sent_to: recipients.length,
    pending_count: pending.length,
    fallback,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
