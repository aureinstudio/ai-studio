/**
 * 인시던트 레벨 + 알림 라우팅.
 *
 * 4단계:
 *   L1 INFO       — 24h 응답, slack only
 *   L2 WARNING    — 4h, slack + email
 *   L3 CRITICAL   — 1h, slack + email + sms*
 *   L4 EMERGENCY  — 즉시, all channels + phone*
 *
 *   *SMS/phone은 현재 미통합 — email로 대체 (Twilio·PagerDuty 후속 작업).
 *
 * 기록: incidents 테이블에 자동 row 추가 (audit_log와 별도, ops 사이클 추적용).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmin } from "@/lib/notifications/email";

export type IncidentLevel = "L1" | "L2" | "L3" | "L4";

const LEVEL_META: Record<IncidentLevel, {
  label: string;
  emoji: string;
  emailLevel: "ok" | "warning" | "danger";
  channels: ("email")[];
}> = {
  L1: { label: "INFO",      emoji: "ℹ️", emailLevel: "ok",      channels: [] },
  L2: { label: "WARNING",   emoji: "⚠️", emailLevel: "warning", channels: ["email"] },
  L3: { label: "CRITICAL",  emoji: "🚨", emailLevel: "danger",  channels: ["email"] },
  L4: { label: "EMERGENCY", emoji: "🔥", emailLevel: "danger",  channels: ["email"] },
};

export type IncidentInput = {
  level: IncidentLevel;
  category: string;        // e.g. 'cost', 'latency', 'security', 'data', 'safety'
  title: string;
  body?: string;
  fields?: { title: string; value: string }[];
  metadata?: Record<string, unknown>;
  action_url?: string;
  action_label?: string;
};

/**
 * 인시던트 발생 — DB 기록 + 채널 알림.
 * fail-soft: 알림 실패가 호출처를 막지 않음.
 */
export async function raiseIncident(
  supabase: SupabaseClient,
  input: IncidentInput,
): Promise<void> {
  const meta = LEVEL_META[input.level];

  // 1. DB 기록 (실패해도 알림 시도)
  try {
    await supabase.from("incidents").insert({
      level: input.level,
      category: input.category,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.warn("[incidents] DB insert failed (non-fatal):", err);
  }

  // 2. 채널 알림 (L1은 DB만, 알림 X — 노이즈 회피)
  if (meta.channels.includes("email")) {
    try {
      await notifyAdmin({
        title: `${meta.emoji} [${meta.label}] ${input.title}`,
        body: input.body,
        fields: input.fields,
        level: meta.emailLevel,
        action_url: input.action_url,
        action_label: input.action_label,
      });
    } catch (err) {
      console.warn("[incidents] email send failed (non-fatal):", err);
    }
  }
}
