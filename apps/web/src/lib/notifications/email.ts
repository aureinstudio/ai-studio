/**
 * 이메일 알림 (Resend API).
 *
 * 환경변수:
 *   - RESEND_API_KEY — Resend 대시보드에서 발급
 *   - EMAIL_FROM — 발신자 (기본: onboarding@resend.dev 테스트용)
 *   - ADMIN_ALERT_EMAILS — 수신자 (쉼표 구분, 예: "admin1@keg.com,admin2@keg.com")
 *
 * 미설정 시 조용히 스킵 (fail-soft).
 * Resend Free tier: 3,000 emails/월, 100 emails/일.
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "KEG AI Studio <onboarding@resend.dev>";

export type EmailField = {
  title: string;
  value: string;
};

export type AlertOptions = {
  title: string;
  body?: string;
  fields?: EmailField[];
  level?: "ok" | "warning" | "danger";
  action_url?: string;
  action_label?: string;
};

const LEVEL_COLORS = {
  ok: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

function getAdminEmails(): string[] {
  return (process.env.ADMIN_ALERT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * 핵심 이메일 발송 — Resend API.
 */
export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not configured, skipping:", opts.subject);
    return false;
  }
  if (opts.to.length === 0) {
    console.log("[email] no recipients, skipping:", opts.subject);
    return false;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status}: ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[email] send failed (non-fatal):", err);
    return false;
  }
}

/**
 * HTML 템플릿 — 알림 레이아웃.
 */
function buildAlertHtml(opts: AlertOptions): string {
  const level = opts.level ?? "warning";
  const color = LEVEL_COLORS[level];

  const fieldsHtml = (opts.fields ?? [])
    .map(
      (f) =>
        `<tr><td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:140px;vertical-align:top;">${escapeHtml(f.title)}</td><td style="padding:8px 0;color:#18181b;font-size:14px;line-height:1.6;">${escapeHtml(f.value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");

  const actionBtn = opts.action_url
    ? `<div style="margin-top:24px;"><a href="${opts.action_url}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(opts.action_label ?? "확인하기")}</a></div>`
    : "";

  const bodyHtml = opts.body
    ? `<p style="color:#27272a;font-size:14px;line-height:1.6;margin:0 0 16px;">${escapeHtml(opts.body).replace(/\n/g, "<br>")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','맑은 고딕',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <div style="height:6px;background:${color};"></div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;line-height:1.4;">${escapeHtml(opts.title)}</h1>
        ${bodyHtml}
        ${fieldsHtml ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${fieldsHtml}</table>` : ""}
        ${actionBtn}
      </div>
      <div style="padding:16px 24px;background:#f4f4f5;border-top:1px solid #e4e4e7;">
        <p style="margin:0;color:#71717a;font-size:11px;line-height:1.5;">
          KEG AI Studio · 자동 발송 알림 · 본 이메일에 회신하지 마세요.<br>
          관리자 대시보드: <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app"}/admin" style="color:#3b82f6;">/admin</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildAlertText(opts: AlertOptions): string {
  const lines = [opts.title, ""];
  if (opts.body) lines.push(opts.body, "");
  for (const f of opts.fields ?? []) {
    lines.push(`${f.title}: ${f.value}`);
  }
  if (opts.action_url) {
    lines.push("", `${opts.action_label ?? "확인"}: ${opts.action_url}`);
  }
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 관리자 알림 발송 (#09 학생 위험 감지 등).
 * low severity는 노이즈 회피 — 발송 안 함.
 */
export async function notifyAdminAlert(input: {
  alert_type: string;
  severity: "low" | "medium" | "high";
  student_label: string;
  evidence: string[];
  intervention?: string | null;
  dropout_risk?: number | null;
}): Promise<void> {
  if (input.severity === "low") return;

  const recipients = getAdminEmails();
  if (recipients.length === 0) return;

  const titlePrefix = input.severity === "high" ? "🚨 [긴급]" : "⚠️ [주의]";
  const opts: AlertOptions = {
    title: `${titlePrefix} ${input.alert_type} 감지 — ${input.student_label}`,
    level: input.severity === "high" ? "danger" : "warning",
    fields: [
      { title: "위험 유형", value: input.alert_type },
      { title: "심각도", value: input.severity },
      ...(input.dropout_risk != null
        ? [{ title: "이탈 위험 점수", value: `${input.dropout_risk}/100` }]
        : []),
      {
        title: "근거",
        value: input.evidence.slice(0, 3).map((e) => `• ${e}`).join("\n") || "(없음)",
      },
      ...(input.intervention
        ? [{ title: "권장 조치", value: input.intervention }]
        : []),
    ],
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app"}/admin/students`,
    action_label: "학생 알림 대시보드 →",
  };

  await sendEmail({
    to: recipients,
    subject: opts.title,
    html: buildAlertHtml(opts),
    text: buildAlertText(opts),
  });
}

/**
 * Cron 작업 결과 보고.
 */
export async function notifyCronResult(input: {
  job_name: string;
  status: "success" | "warning" | "failed";
  summary: string;
  details?: EmailField[];
}): Promise<void> {
  const recipients = getAdminEmails();
  if (recipients.length === 0) return;
  // 성공이면서 details 없으면 노이즈 → 스킵
  if (input.status === "success" && (!input.details || input.details.length === 0)) return;

  const emoji =
    input.status === "success" ? "✅" : input.status === "warning" ? "⚠️" : "❌";
  const opts: AlertOptions = {
    title: `${emoji} Cron [${input.job_name}] — ${input.status}`,
    body: input.summary,
    fields: input.details,
    level:
      input.status === "success" ? "ok" : input.status === "warning" ? "warning" : "danger",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app"}/admin/integration`,
    action_label: "통합 대시보드 →",
  };
  await sendEmail({
    to: recipients,
    subject: opts.title,
    html: buildAlertHtml(opts),
    text: buildAlertText(opts),
  });
}

/**
 * 일반 알림 (기타).
 */
export async function notifyAdmin(opts: AlertOptions): Promise<void> {
  const recipients = getAdminEmails();
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: opts.title,
    html: buildAlertHtml(opts),
    text: buildAlertText(opts),
  });
}
