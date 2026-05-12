import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, sendEmail } from "@/lib/notifications/email";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { detectThreats } from "@/lib/security/input-filter";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(120),
  name: z.string().max(60).optional(),
  category: z.enum(["technical", "content_error", "billing", "other"]),
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(3000),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit("auth:login", null, { ipFallback: ip });
  if (!rl.allowed) return rateLimitResponse(rl, "문의 제출이 너무 많습니다.");

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const threat = detectThreats(parsed.data.body);
  if (threat.blocked) return NextResponse.json({ error: "input_blocked" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      user_id: user?.id ?? null,
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name ?? null,
      category: parsed.data.category,
      subject: parsed.data.subject,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !ticket) {
    return NextResponse.json({ error: "insert_failed", detail: error?.message }, { status: 500 });
  }

  // 본부장 알림
  await notifyAdmin({
    title: `🆘 신규 문의 [${parsed.data.category}] ${parsed.data.subject}`,
    body: parsed.data.body,
    fields: [
      { title: "이름", value: parsed.data.name ?? "(미기재)" },
      { title: "이메일", value: parsed.data.email },
      { title: "유형", value: parsed.data.category },
    ],
    level: parsed.data.category === "content_error" ? "warning" : "ok",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin`,
    action_label: "관리자 대시보드 →",
  });

  // 신청자 접수 확인
  await sendEmail({
    to: [parsed.data.email],
    subject: `[KEG AI Studio] 문의 접수 — ${parsed.data.subject}`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b;">
      <h1 style="font-size:18px;font-weight:600;">문의가 접수되었습니다 ✓</h1>
      <p style="font-size:14px;line-height:1.7;">제목: <strong>${escape(parsed.data.subject)}</strong></p>
      <p style="font-size:14px;line-height:1.7;">접수번호: ${ticket.id.slice(0,8)}</p>
      <p style="font-size:14px;line-height:1.7;">24시간 이내 답변 메일을 보내드리겠습니다.</p>
    </body></html>`,
    text: `문의가 접수되었습니다. 24시간 이내 답변드립니다. 접수번호: ${ticket.id.slice(0,8)}`,
  });

  return NextResponse.json({ ok: true, ticket_id: ticket.id });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
