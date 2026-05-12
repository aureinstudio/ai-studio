/**
 * PostHog server-side — API 라우트·cron에서 호출.
 * 학생 액션을 서버측에서 검증된 형태로 기록 (클라이언트 위변조 회피).
 *
 * fail-soft: 키 미설정 시 noop.
 */
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export async function trackServer(
  userId: string,
  event: string,
  props?: Record<string, unknown>,
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({ distinctId: userId, event, properties: props });
    await c.flush();
  } catch (err) {
    console.warn("[posthog-server] capture failed (non-fatal):", err);
  }
}
