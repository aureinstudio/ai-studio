/**
 * 자동 격려 메시지 트리거 평가 + 발송.
 *
 * 트리거:
 *   - inactive_3d:   3일 미접속 학생 → 부드러운 알림
 *   - milestone_10h: tutor_conversations 합산 10h+ → 마일스톤 축하
 *
 * Dedup: care_messages_log(user, trigger, date) unique. 같은 날 중복 발송 X.
 * 7일 미접속은 별도 learning-reminder cron이 담당 — 본 모듈은 3일 (먼저 잡아냄).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/notifications/email";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";

export type CareTrigger = "inactive_3d" | "milestone_10h";

type Profile = { id: string; email: string | null; name: string | null; last_seen_at: string | null };

async function logSent(supabase: SupabaseClient, userId: string, trigger: CareTrigger): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("care_messages_log")
    .insert({ user_id: userId, trigger, sent_date: today });
  return !error; // 이미 보낸 경우 unique 위반 → false
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inactiveEmail(name: string): { html: string; text: string; subject: string } {
  return {
    subject: "📚 잠깐 들렀다 가세요",
    text: `${name}님, 3일째 학습이 멈춰 있어요. 5분만 짧게 시작해 보세요.`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
      <h1 style="font-size:20px;font-weight:600;">${escapeHtml(name)}님, 잠깐 들러주세요 🙂</h1>
      <p style="font-size:14px;line-height:1.7;">3일째 학습이 잠시 멈춰 있어요. 큰 부담 없이 5분만, 짧은 질문 하나로 다시 시작해 보세요. 작은 누적이 결국 큰 차이를 만듭니다.</p>
      <p style="margin:20px 0;"><a href="${BASE_URL}/tutor" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">5분 학습 시작 →</a></p>
      <p style="font-size:12px;color:#71717a;">알림 끄기: 대시보드 → 설정</p>
    </body></html>`,
  };
}

function milestoneEmail(name: string, hours: number): { html: string; text: string; subject: string } {
  return {
    subject: `🎉 ${name}님, ${hours}시간 학습 마일스톤 달성!`,
    text: `누적 학습 시간 ${hours}시간을 달성하셨습니다. 꾸준함이 시험 합격의 가장 강력한 무기예요.`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
      <h1 style="font-size:22px;font-weight:700;">🎉 ${escapeHtml(name)}님, 축하합니다!</h1>
      <p style="font-size:14px;line-height:1.7;">누적 학습 시간 <strong>${hours}시간</strong>을 달성하셨어요. 꾸준함이 시험 합격의 가장 강력한 무기입니다. 이 페이스라면 충분합니다.</p>
      <p style="font-size:14px;line-height:1.7;color:#52525b;">다음 마일스톤: 20시간 — 함께 가요.</p>
      <p style="margin:20px 0;"><a href="${BASE_URL}/dashboard" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">대시보드 →</a></p>
    </body></html>`,
  };
}

/**
 * 메인 진입점 — 매일 새벽 호출. 두 트리거 평가 후 dedup 통과한 학생만 발송.
 * @returns 발송 카운트.
 */
export async function runAutoCareMessages(supabase: SupabaseClient): Promise<{
  inactive3d_sent: number;
  milestone_sent: number;
}> {
  let inactive3dSent = 0;
  let milestoneSent = 0;

  const now = Date.now();
  const since3d = new Date(now - 3 * 86400_000).toISOString();
  const since7d = new Date(now - 7 * 86400_000).toISOString();

  // 1) inactive_3d — 3~7일 미접속 (7일 이상은 learning-reminder가 처리)
  const { data: inactives } = await supabase
    .from("profiles")
    .select("id, email, name, last_seen_at")
    .eq("role", "user")
    .not("email", "is", null)
    .lt("last_seen_at", since3d)
    .gte("last_seen_at", since7d)
    .limit(500);

  for (const p of (inactives ?? []) as Profile[]) {
    if (!p.email) continue;
    const ok = await logSent(supabase, p.id, "inactive_3d");
    if (!ok) continue;
    const tpl = inactiveEmail(p.name ?? "학습자");
    await sendEmail({ to: [p.email], subject: tpl.subject, html: tpl.html, text: tpl.text });
    inactive3dSent++;
  }

  // 2) milestone_10h — 누적 학습 시간 10h+ 통과 (tutor_conversations 활동 시간 근사)
  // 근사: tutor_conversations.total_messages × 60s ≈ 학습 시간. 10h = 600 messages.
  // 더 정확한 측정은 향후 학습 세션 테이블 별도 도입 시 가능.
  const { data: milestoners } = await supabase
    .from("tutor_conversations")
    .select("student_id, total_messages")
    .gte("total_messages", 600);
  const byStudent: Record<string, number> = {};
  for (const r of milestoners ?? []) {
    const k = r.student_id as string;
    byStudent[k] = (byStudent[k] ?? 0) + (r.total_messages ?? 0);
  }
  const milestoneIds = Object.entries(byStudent)
    .filter(([, n]) => n >= 600)
    .map(([id]) => id);

  if (milestoneIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", milestoneIds);
    for (const p of (profs ?? []) as Profile[]) {
      if (!p.email) continue;
      const ok = await logSent(supabase, p.id, "milestone_10h");
      if (!ok) continue;
      const hours = Math.floor(byStudent[p.id] / 60);
      const tpl = milestoneEmail(p.name ?? "학습자", hours);
      await sendEmail({ to: [p.email], subject: tpl.subject, html: tpl.html, text: tpl.text });
      milestoneSent++;
    }
  }

  return { inactive3d_sent: inactive3dSent, milestone_sent: milestoneSent };
}
