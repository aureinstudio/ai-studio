/**
 * Resend 이메일 발송.
 *
 * 환경 변수:
 *   RESEND_API_KEY      : Resend API 키 (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL   : 발신자 이메일 (예: 'ai-studio <noreply@ai-studio.kr>')
 *
 * 미설정 시 email_log에 status='failed'로 기록만 하고 silent return.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  related_table?: string;
  related_id?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; resend_id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "ai-studio <noreply@ai-studio.kr>";
  const admin = createAdminClient();

  // 사전 로그
  const { data: logRow } = await admin.from("email_log").insert({
    recipient: input.to,
    subject: input.subject,
    template: input.template ?? null,
    related_table: input.related_table ?? null,
    related_id: input.related_id ?? null,
    status: "queued",
  }).select("id").single();

  if (!apiKey) {
    await admin.from("email_log").update({
      status: "failed",
      error: "RESEND_API_KEY not configured",
    }).eq("id", logRow?.id);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? (input.html ? undefined : input.subject),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json?.message ?? `HTTP ${res.status}`;
      await admin.from("email_log").update({ status: "failed", error: errMsg }).eq("id", logRow?.id);
      return { ok: false, error: errMsg };
    }
    const resendId = json?.id as string;
    await admin.from("email_log").update({
      status: "sent",
      resend_id: resendId,
      sent_at: new Date().toISOString(),
    }).eq("id", logRow?.id);
    return { ok: true, resend_id: resendId };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "unknown";
    await admin.from("email_log").update({ status: "failed", error: errMsg }).eq("id", logRow?.id);
    return { ok: false, error: errMsg };
  }
}

/**
 * 간단 HTML 템플릿 — 일관된 헤더·푸터 적용.
 */
export function wrapEmailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px;">ai-studio</h1>
  </div>
  ${body}
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    KEG · Korean Education Group<br>
    이 메일은 ai-studio 자동 발송입니다. 문의: aureinstudio@gmail.com
  </div>
</body></html>`;
}
