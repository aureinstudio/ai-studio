import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 매주 금요일 09:00 KST (00:00 UTC 금) NPS 응답 안내.
 * 이번 주 NPS 미응답 학생에게만 발송.
 *
 * Cron schedule: "0 0 * * 5" (금요일 00 UTC = 09 KST 금요일).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 이번 주 시작 (월요일 00:00 UTC)
  const weekStart = (() => {
    const d = new Date();
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  // 학생 — 최근 14일 활성 + 이메일 있음
  const { data: actives } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("role", "user")
    .not("email", "is", null)
    .gte("last_seen_at", since14d)
    .limit(500);

  if (!actives || actives.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no_actives" });
  }

  // 이번 주 이미 응답한 사용자
  const { data: respondedRows } = await admin
    .from("nps_responses")
    .select("user_id")
    .gte("created_at", weekStart);
  const respondedSet = new Set((respondedRows ?? []).map((r) => r.user_id));

  const targets = actives.filter((u) => !respondedSet.has(u.id));

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
  let sent = 0;
  for (const u of targets) {
    if (!u.email) continue;
    await sendEmail({
      to: [u.email],
      subject: "📝 짧은 추천 설문 (2분)",
      html: html(u.name ?? "학습자", base),
      text: `${u.name ?? "학습자"}님, ai-studio를 친구·동료에게 추천하시겠습니까? ${base}/dashboard/nps`,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, total_actives: actives.length, already_responded: respondedSet.size, sent });
}

function html(name: string, base: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 2분만 시간 내주실 수 있나요?</h1>
    <p style="font-size:14px;line-height:1.7;">ai-studio를 친구·동료에게 추천하시겠습니까? 정식 출시 의사결정에 본부장이 직접 참고합니다.</p>
    <p style="margin:24px 0;">
      <a href="${base}/dashboard/nps" style="display:inline-block;padding:14px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">설문 응답 (1분) →</a>
    </p>
    <p style="font-size:12px;color:#71717a;">본인 응답이 누적되어 정식 출시 여부·우선 기능을 결정합니다.</p>
  </body></html>`;
}
