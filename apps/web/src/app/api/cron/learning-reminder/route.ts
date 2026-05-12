import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron — 매시간 (0 * * * *).
 * KST 기준 사용자 preferred_hour와 매칭되는 슬롯에 일일 알림 발송.
 * 또한 7일 미접속자에게 격려 알림.
 *
 * Dedup: learning_reminders_log에 (user, type, date) unique → 하루 1회 보장.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  // KST = UTC + 9
  const kstHour = (now.getUTCHours() + 9) % 24;
  const today = now.toISOString().slice(0, 10);

  // 1) 일일 학습 알림 — preferred_hours 슬롯과 현재 KST 시간 매칭
  // 슬롯 라벨 → 시작 시 매핑
  const SLOT_START_KST: Record<string, number> = {
    "아침 6~9시": 7,
    "오전 9~12시": 10,
    "점심 12~14시": 12,
    "오후 14~18시": 15,
    "저녁 18~22시": 19,
    "심야 22~02시": 22,
  };
  const matchingSlots = Object.entries(SLOT_START_KST)
    .filter(([, h]) => h === kstHour)
    .map(([s]) => s);

  let dailySent = 0;
  if (matchingSlots.length > 0) {
    // 해당 슬롯을 선택한 사용자 조회
    const { data: users } = await admin
      .from("profiles")
      .select("id, email, name, learning_prefs")
      .eq("role", "user")
      .not("email", "is", null)
      .limit(500);

    for (const u of users ?? []) {
      const prefs = (u.learning_prefs ?? {}) as { preferred_hours?: string[]; daily_reminder?: boolean };
      if (prefs.daily_reminder === false) continue;
      const overlap = (prefs.preferred_hours ?? []).some((p) => matchingSlots.includes(p));
      if (!overlap) continue;
      if (!u.email) continue;

      // dedup
      const { error: dupErr } = await admin
        .from("learning_reminders_log")
        .insert({ user_id: u.id, reminder_type: "daily", sent_date: today });
      if (dupErr) continue; // 이미 발송함

      await sendEmail({
        to: [u.email],
        subject: "📚 오늘 학습 시간이에요",
        html: dailyEmailHtml(u.name ?? "학습자"),
        text: `${u.name ?? "학습자"}님, 오늘 학습 시간이 시작됐어요. 짧게라도 한 단원 살펴보세요.`,
      });
      dailySent++;
    }
  }

  // 2) 7일 미접속 격려 — 09시 KST 1회만 (kstHour === 9)
  let inactiveSent = 0;
  if (kstHour === 9) {
    const since7d = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const { data: inactives } = await admin
      .from("profiles")
      .select("id, email, name, last_seen_at")
      .eq("role", "user")
      .not("email", "is", null)
      .lt("last_seen_at", since7d)
      .limit(200);

    for (const u of inactives ?? []) {
      if (!u.email) continue;
      const { error: dupErr } = await admin
        .from("learning_reminders_log")
        .insert({ user_id: u.id, reminder_type: "inactive_7d", sent_date: today });
      if (dupErr) continue;

      await sendEmail({
        to: [u.email],
        subject: "👋 다시 시작해볼까요?",
        html: inactiveEmailHtml(u.name ?? "학습자"),
        text: `${u.name ?? "학습자"}님, 7일째 못 뵈었네요. 짧은 질문 하나로 다시 시작해 보세요.`,
      });
      inactiveSent++;
    }
  }

  return NextResponse.json({
    kst_hour: kstHour,
    matching_slots: matchingSlots,
    daily_sent: dailySent,
    inactive_sent: inactiveSent,
  });
}

function dailyEmailHtml(name: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 학습 시간입니다 📚</h1>
    <p style="font-size:14px;line-height:1.7;">오늘 짧게라도 한 단원을 살펴보세요. 막히는 부분은 AI Tutor가 24/7 답변합니다.</p>
    <p style="margin:20px 0;"><a href="${base}/tutor" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">학습 시작 →</a></p>
    <p style="font-size:12px;color:#71717a;">알림을 끄려면 대시보드 → 설정에서 변경하세요.</p>
  </body></html>`;
}

function inactiveEmailHtml(name: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 잘 지내시나요? 👋</h1>
    <p style="font-size:14px;line-height:1.7;">7일째 학습이 잠시 멈춰 있어요. 5분만 투자해 짧은 질문 하나로 다시 시작해 보세요.</p>
    <p style="font-size:14px;line-height:1.7;">시험이 다가오는 지금, 작은 누적이 큰 차이를 만듭니다.</p>
    <p style="margin:20px 0;"><a href="${base}/tutor" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">5분 학습 시작 →</a></p>
  </body></html>`;
}
