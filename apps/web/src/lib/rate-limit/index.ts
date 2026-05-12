/**
 * Rate Limiting — Upstash Redis 기반.
 *
 * 미설정(UPSTASH_REDIS_REST_URL 없음) 시: fail-open (limit 검사 통과).
 * Production에서는 반드시 설정 필요. dev 환경에서는 옵션.
 *
 * 정책 매트릭스:
 *   tutor:ask        — 분당 10회 (user)
 *   studio:generate  — 시간당 5회 (user)
 *   cast:generate    — 일일 3회 (user) — 비싸므로 강한 제한
 *   auth:login       — 15분당 5회 (ip)
 *   admin            — 모든 limit 면제
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitKey = "tutor:ask" | "studio:generate" | "cast:generate" | "auth:login";

type PolicyDef = {
  limiter: ReturnType<typeof Ratelimit.slidingWindow>;
  scope: "user" | "ip";
  prefix: string;
};

let redis: Redis | null = null;
let limiters: Record<LimitKey, Ratelimit> | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const POLICIES: Record<LimitKey, Omit<PolicyDef, "limiter"> & { window: `${number} ${"s" | "m" | "h" | "d"}`; max: number }> = {
  "tutor:ask":       { scope: "user", prefix: "rl:tutor",  window: "1 m", max: 10 },
  "studio:generate": { scope: "user", prefix: "rl:studio", window: "1 h", max: 5 },
  "cast:generate":   { scope: "user", prefix: "rl:cast",   window: "1 d", max: 3 },
  "auth:login":      { scope: "ip",   prefix: "rl:auth",   window: "15 m", max: 5 },
};

function getLimiters(): Record<LimitKey, Ratelimit> | null {
  const r = getRedis();
  if (!r) return null;
  if (limiters) return limiters;
  const out = {} as Record<LimitKey, Ratelimit>;
  for (const [key, p] of Object.entries(POLICIES) as [LimitKey, typeof POLICIES[LimitKey]][]) {
    out[key] = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(p.max, p.window),
      prefix: p.prefix,
      analytics: true,
    });
  }
  limiters = out;
  return limiters;
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix ms
  retryAfterSec: number;
  bypassed?: "no-redis" | "admin";
};

export type RateLimitOpts = {
  isAdmin?: boolean;
  ipFallback?: string | null;
};

/**
 * Rate limit 검사.
 * - userId 우선 (scope=user 정책)
 * - ip는 scope=ip 정책 또는 userId 없을 때 fallback
 * - admin은 항상 통과
 * - Redis 미설정 시 fail-open (allowed=true, bypassed='no-redis')
 */
export async function checkRateLimit(
  key: LimitKey,
  userId: string | null,
  opts: RateLimitOpts = {},
): Promise<RateLimitResult> {
  if (opts.isAdmin) {
    return { allowed: true, limit: 0, remaining: 0, reset: 0, retryAfterSec: 0, bypassed: "admin" };
  }
  const lim = getLimiters();
  const policy = POLICIES[key];
  if (!lim) {
    return { allowed: true, limit: policy.max, remaining: policy.max, reset: 0, retryAfterSec: 0, bypassed: "no-redis" };
  }
  const identifier =
    policy.scope === "ip"
      ? `ip:${opts.ipFallback ?? "unknown"}`
      : `u:${userId ?? opts.ipFallback ?? "anon"}`;
  const r = await lim[key].limit(identifier);
  const retryAfterSec = r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  return {
    allowed: r.success,
    limit: r.limit,
    remaining: r.remaining,
    reset: r.reset,
    retryAfterSec,
  };
}

/**
 * 429 Response 헬퍼 — 표준 헤더 부착.
 */
export function rateLimitResponse(result: RateLimitResult, message = "Too many requests"): Response {
  return new Response(JSON.stringify({ error: "rate_limit_exceeded", message, retry_after_sec: result.retryAfterSec }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSec),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset),
    },
  });
}

/**
 * 클라이언트 IP 추출 — Vercel/Cloudflare 표준 헤더.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}
