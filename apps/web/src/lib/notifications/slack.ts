/**
 * Slack Incoming Webhook 통합.
 *
 * 환경변수: SLACK_WEBHOOK_URL (Slack 채널 #student-care 또는 #ops 등)
 *
 * 사용:
 *   - admin_alerts high severity → 즉시 Slack 알림
 *   - Cron 결과 (계정 정리·비용 임계) → Slack 보고
 *
 * fail-soft: webhook 실패해도 메인 흐름 차단 안 함.
 */

export type SlackField = {
  title: string;
  value: string;
  short?: boolean;
};

export type SlackAlertOptions = {
  /** 알림 헤더 (이모지 포함 권장) */
  title: string;
  /** 본문 (markdown 지원) */
  body?: string;
  /** key-value 필드 (학생 ID, 위험 유형 등) */
  fields?: SlackField[];
  /** ok / warning / danger — 좌측 색깔 바 */
  level?: "ok" | "warning" | "danger";
  /** 액션 링크 (예: /admin/students) */
  action_url?: string;
  action_label?: string;
};

const LEVEL_COLORS = {
  ok: "#10b981", // emerald
  warning: "#f59e0b", // amber
  danger: "#ef4444", // red
} as const;

/**
 * Slack에 알림 전송. 실패해도 throw X (fail-soft).
 */
export async function sendSlackAlert(options: SlackAlertOptions): Promise<boolean> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.log("[slack] SLACK_WEBHOOK_URL not configured, skipping:", options.title);
    return false;
  }

  const level = options.level ?? "warning";

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: options.title.slice(0, 150) },
    },
  ];

  if (options.body) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: options.body.slice(0, 2900) },
    });
  }

  if (options.fields && options.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: options.fields.slice(0, 10).map((f) => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value.slice(0, 1900)}`,
      })),
    });
  }

  if (options.action_url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: options.action_label ?? "확인하기" },
          url: options.action_url,
          style: level === "danger" ? "danger" : "primary",
        },
      ],
    });
  }

  const payload = {
    text: options.title, // fallback for notifications
    attachments: [
      {
        color: LEVEL_COLORS[level],
        blocks,
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[slack] ${res.status}: ${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[slack] webhook failed (non-fatal):", err);
    return false;
  }
}

/**
 * admin_alerts 발생 시 호출. severity에 따라 자동 색상.
 */
export async function notifyAdminAlert(input: {
  alert_type: string;
  severity: "low" | "medium" | "high";
  student_label: string;
  evidence: string[];
  intervention?: string | null;
  dropout_risk?: number | null;
  origin_url?: string;
}): Promise<void> {
  // low는 노이즈 — Slack 발송 안 함
  if (input.severity === "low") return;

  const titlePrefix =
    input.severity === "high" ? "🚨 [긴급]" : "⚠️ [주의]";

  await sendSlackAlert({
    title: `${titlePrefix} ${input.alert_type} 감지 — ${input.student_label}`,
    level: input.severity === "high" ? "danger" : "warning",
    fields: [
      { title: "위험 유형", value: input.alert_type, short: true },
      { title: "심각도", value: input.severity, short: true },
      ...(input.dropout_risk != null
        ? [{ title: "이탈 위험 점수", value: `${input.dropout_risk}/100`, short: true }]
        : []),
      {
        title: "근거",
        value: input.evidence.slice(0, 3).map((e) => `• ${e}`).join("\n") || "(없음)",
      },
      ...(input.intervention
        ? [{ title: "권장 조치", value: input.intervention }]
        : []),
    ],
    action_url: input.origin_url ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app"}/admin/students`,
    action_label: "학생 알림 대시보드",
  });
}

/**
 * Cron 결과 보고용 (계정 정리·비용 임계 등).
 */
export async function notifyCronResult(input: {
  job_name: string;
  status: "success" | "warning" | "failed";
  summary: string;
  details?: SlackField[];
}): Promise<void> {
  const emoji =
    input.status === "success" ? "✅" : input.status === "warning" ? "⚠️" : "❌";
  await sendSlackAlert({
    title: `${emoji} Cron [${input.job_name}] — ${input.status}`,
    body: input.summary,
    fields: input.details,
    level:
      input.status === "success"
        ? "ok"
        : input.status === "warning"
          ? "warning"
          : "danger",
  });
}
