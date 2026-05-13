import { describe, it, expect, beforeEach, vi } from "vitest";

// 모듈 단위 singleton 캐시(redis, limiters) 무력화: 매 테스트마다 모듈 재로드.
async function freshModule() {
  vi.resetModules();
  return await import("./index");
}

describe("rate-limit — checkRateLimit", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("admin bypass — limit 우회", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { checkRateLimit } = await freshModule();
    const r = await checkRateLimit("tutor:ask", "user-1", { isAdmin: true });
    expect(r.allowed).toBe(true);
    expect(r.bypassed).toBe("admin");
  });

  it("Upstash 미설정 → fail-open (allowed=true, bypassed=no-redis)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { checkRateLimit } = await freshModule();
    const r = await checkRateLimit("tutor:ask", "user-2");
    expect(r.allowed).toBe(true);
    expect(r.bypassed).toBe("no-redis");
    expect(r.limit).toBe(10); // tutor:ask 정책의 max
  });

  it("admin이지만 Upstash 미설정인 경우에도 통과", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    const { checkRateLimit } = await freshModule();
    const r = await checkRateLimit("studio:generate", "u-3", { isAdmin: true });
    expect(r.allowed).toBe(true);
  });

  it("rateLimitResponse 헤더 정확", async () => {
    const { rateLimitResponse } = await freshModule();
    const res = rateLimitResponse({
      allowed: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30000,
      retryAfterSec: 30,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("rate-limit — getClientIp", () => {
  it("x-forwarded-for 첫번째 값 추출", async () => {
    const { getClientIp } = await freshModule();
    const req = new Request("http://test/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("x-real-ip fallback", async () => {
    const { getClientIp } = await freshModule();
    const req = new Request("http://test/", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("아무 헤더도 없으면 'unknown'", async () => {
    const { getClientIp } = await freshModule();
    const req = new Request("http://test/");
    expect(getClientIp(req)).toBe("unknown");
  });
});
