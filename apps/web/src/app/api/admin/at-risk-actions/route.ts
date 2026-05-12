import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, notifyAdmin } from "@/lib/notifications/email";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["encourage", "instructor", "session", "ack"]),
  student_id: z.string().uuid(),
  alert_ids: z.array(z.string().uuid()).max(50).default([]),
  note: z.string().max(500).optional(),
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: student } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("id", parsed.data.student_id)
    .maybeSingle();
  if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  const name = student.name ?? "학습자";

  if (parsed.data.action === "encourage") {
    if (!student.email) return NextResponse.json({ error: "no_email" }, { status: 400 });
    await sendEmail({
      to: [student.email],
      subject: `${name}님, 잘 하고 계세요 💪`,
      html: encourageHtml(name),
      text: `${name}님, 학습이 잠시 어려울 수 있어요. 본부장이 직접 응원합니다.`,
    });
    return NextResponse.json({ ok: true, channel: "email" });
  }

  if (parsed.data.action === "session") {
    if (!student.email) return NextResponse.json({ error: "no_email" }, { status: 400 });
    await sendEmail({
      to: [student.email],
      subject: `${name}님, 1:1 세션 제안 드립니다`,
      html: sessionHtml(name),
      text: `${name}님, 본부장과 1:1 세션(15분)을 제안드립니다. 회신 부탁드립니다.`,
    });
    return NextResponse.json({ ok: true, channel: "email" });
  }

  if (parsed.data.action === "instructor") {
    // 본부장(자기 자신)에게 알림 + DB에 incidents 로그
    await notifyAdmin({
      title: `👨‍🏫 강사 연락 요청 — ${name}`,
      body: `${name} (${student.email ?? student.id.slice(0,8)})에 대한 강사 직접 연락이 필요합니다.`,
      fields: [
        { title: "학생 ID", value: student.id },
        { title: "이메일", value: student.email ?? "(없음)" },
        ...(parsed.data.note ? [{ title: "메모", value: parsed.data.note }] : []),
      ],
      level: "warning",
      action_url: `${BASE_URL}/admin/at-risk-students`,
      action_label: "위험 학생 →",
    });
    try {
      await admin.from("incidents").insert({
        level: "L2",
        category: "student_care",
        title: `강사 연락 요청 — ${name}`,
        body: parsed.data.note ?? null,
        metadata: { student_id: student.id, email: student.email },
      });
    } catch {
      // fail-soft
    }
    return NextResponse.json({ ok: true, channel: "admin_notification" });
  }

  // ack — 해당 알림들을 acknowledged로 처리
  if (parsed.data.alert_ids.length > 0) {
    await admin
      .from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .in("id", parsed.data.alert_ids);
  }
  return NextResponse.json({ ok: true, acked: parsed.data.alert_ids.length });
}

function encourageHtml(name: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 응원합니다 💪</h1>
    <p style="font-size:14px;line-height:1.7;">학습이 잠시 어렵게 느껴지셨을 수 있어요. 본부장이 직접 챙겨보고 있습니다 — 막히는 부분이 있으면 부담 없이 답장 주세요.</p>
    <p style="font-size:14px;line-height:1.7;">한 단계씩, 본인의 페이스로 충분합니다. AI Tutor도 24/7 곁에 있어요.</p>
    <p style="margin:20px 0;"><a href="${BASE_URL}/tutor" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">짧게 시작 →</a></p>
    <p style="font-size:12px;color:#71717a;">- KEG AI Studio 본부장 드림</p>
  </body></html>`;
}

function sessionHtml(name: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 1:1 세션 제안</h1>
    <p style="font-size:14px;line-height:1.7;">학습 중 어려운 부분이나 진로/시험 관련 고민을 15분 1:1로 함께 살펴보고 싶습니다.</p>
    <p style="font-size:14px;line-height:1.7;">가능한 시간대 2~3개를 회신 주시면 일정을 맞춰드리겠습니다.</p>
    <p style="font-size:12px;color:#71717a;margin-top:24px;">- KEG AI Studio 본부장 드림</p>
  </body></html>`;
}
