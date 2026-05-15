/**
 * Webhook 발송 — HMAC SHA256 서명.
 *
 * 헤더:
 *   X-AI-Studio-Event       : 이벤트 타입 (예: studio.completed)
 *   X-AI-Studio-Delivery    : 고유 delivery_id (재시도 시 같은 id)
 *   X-AI-Studio-Signature   : t=<timestamp>,v1=<HMAC>
 *   X-AI-Studio-Timestamp   : Unix epoch (ms)
 *
 * Body: JSON payload.
 *
 * 실패 시 backoff 재시도 — 1m, 5m, 30m, 2h, 12h, 24h (총 6회). 그 후 포기.
 */
import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookEvent =
  | "studio.completed"
  | "studio.failed"
  | "cast.completed"
  | "cast.failed"
  | "tutor.flagged";

const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

function sign(secret: string, body: string, timestamp: number): string {
  const payload = `${timestamp}.${body}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * 특정 tenant의 활성 endpoint들에 event 발송.
 * 비동기 — 각 endpoint마다 webhook_deliveries row 생성 + fetch.
 */
export async function dispatchEvent(
  tenantId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  const { data: endpoints } = await admin
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);

  if (!endpoints || endpoints.length === 0) return;

  // 이벤트에 구독된 endpoint만
  const subscribed = endpoints.filter((e) => {
    const events = (e.events as string[]) ?? [];
    return events.includes("*") || events.includes(eventType);
  });

  await Promise.all(subscribed.map((e) => deliverOnce(e.id, e.url, e.secret, eventType, payload, 1)));
}

async function deliverOnce(
  endpointId: string,
  url: string,
  secret: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
  attempt: number,
): Promise<void> {
  const admin = createAdminClient();
  const timestamp = Date.now();
  const deliveryId = randomUUID();
  const body = JSON.stringify({ id: deliveryId, type: eventType, created_at: new Date(timestamp).toISOString(), data: payload });
  const signature = sign(secret, body, timestamp);

  // delivery row 사전 생성
  const { data: delivery } = await admin
    .from("webhook_deliveries")
    .insert({
      endpoint_id: endpointId,
      event_type: eventType,
      payload,
      attempt,
    })
    .select("id")
    .single();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-AI-Studio-Event": eventType,
        "X-AI-Studio-Delivery": deliveryId,
        "X-AI-Studio-Signature": signature,
        "X-AI-Studio-Timestamp": String(timestamp),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const respBody = await res.text().catch(() => "");
    if (res.ok) {
      await admin.from("webhook_deliveries").update({
        status_code: res.status,
        response_body: respBody.slice(0, 2000),
        delivered_at: new Date().toISOString(),
      }).eq("id", delivery?.id);
      await admin.from("webhook_endpoints").update({
        last_success_at: new Date().toISOString(),
        failure_count: 0,
      }).eq("id", endpointId);
      return;
    }

    // 실패 → 재시도 예약
    await scheduleRetry(admin, delivery?.id, endpointId, url, secret, eventType, payload, attempt, res.status, respBody);
  } catch (e) {
    await scheduleRetry(admin, delivery?.id, endpointId, url, secret, eventType, payload, attempt, null, e instanceof Error ? e.message : "unknown");
  }
}

async function scheduleRetry(
  admin: ReturnType<typeof createAdminClient>,
  deliveryId: string | undefined,
  endpointId: string,
  url: string,
  secret: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
  attempt: number,
  statusCode: number | null,
  errorMsg: string,
): Promise<void> {
  const nextAttempt = attempt + 1;
  if (nextAttempt > MAX_ATTEMPTS) {
    if (deliveryId) {
      await admin.from("webhook_deliveries").update({
        status_code: statusCode,
        error: `gave up after ${MAX_ATTEMPTS} attempts: ${errorMsg}`.slice(0, 500),
      }).eq("id", deliveryId);
    }
    return;
  }

  const backoffMs = BACKOFF_MINUTES[attempt - 1] * 60_000;
  const nextRetry = new Date(Date.now() + backoffMs).toISOString();

  if (deliveryId) {
    await admin.from("webhook_deliveries").update({
      status_code: statusCode,
      error: errorMsg.slice(0, 500),
      next_retry_at: nextRetry,
    }).eq("id", deliveryId);
  }
  await admin.from("webhook_endpoints").update({
    failure_count: attempt,
    last_failure_at: new Date().toISOString(),
  }).eq("id", endpointId);

  // 실제 재시도는 cron으로 처리 (별도 작업) — 이번 PR-A는 1회 시도만.
  console.warn(`[webhooks] ${endpointId} attempt ${attempt} failed, next retry scheduled for ${nextRetry}`);
}
