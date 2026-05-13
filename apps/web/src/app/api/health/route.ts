import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "fail" | "skip";
type Check = { name: string; status: CheckStatus; latency_ms: number; detail?: string };

const TIMEOUT_MS = 4000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

async function checkSupabase(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return { name: "supabase", status: "skip", latency_ms: 0, detail: "URL 미설정" };
  const t = performance.now();
  try {
    const r = await withTimeout(
      fetch(`${url}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } }),
      TIMEOUT_MS,
    );
    return {
      name: "supabase",
      status: r.status < 500 ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "supabase", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

async function checkAnthropic(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { name: "anthropic", status: "skip", latency_ms: 0, detail: "키 미설정" };
  const t = performance.now();
  try {
    // 가장 가벼운 ping — models 목록 (1 token 미만)
    const r = await withTimeout(
      fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      }),
      TIMEOUT_MS,
    );
    return {
      name: "anthropic",
      status: r.ok ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "anthropic", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

async function checkGemini(): Promise<Check> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return { name: "gemini", status: "skip", latency_ms: 0, detail: "키 미설정" };
  const t = performance.now();
  try {
    const r = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`),
      TIMEOUT_MS,
    );
    return {
      name: "gemini",
      status: r.ok ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "gemini", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

async function checkHeyGen(): Promise<Check> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) return { name: "heygen", status: "skip", latency_ms: 0, detail: "키 미설정" };
  const t = performance.now();
  // HeyGen은 외부 미디어 처리 API라 평소 응답 3~6초 — 별도 8초 timeout
  // /v1/user/remaining_quota: 가장 가벼운 인증 ping (계정 잔여 크레딧)
  try {
    const r = await withTimeout(
      fetch("https://api.heygen.com/v1/user/remaining_quota", { headers: { "X-Api-Key": key } }),
      8000,
    );
    return {
      name: "heygen",
      status: r.ok ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "heygen", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

async function checkUpstash(): Promise<Check> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { name: "upstash", status: "skip", latency_ms: 0, detail: "미설정 (fail-open)" };
  const t = performance.now();
  try {
    const r = await withTimeout(
      fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` } }),
      TIMEOUT_MS,
    );
    return {
      name: "upstash",
      status: r.ok ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "upstash", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

async function checkResend(): Promise<Check> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { name: "resend", status: "skip", latency_ms: 0, detail: "미설정 (fail-soft)" };
  const t = performance.now();
  try {
    const r = await withTimeout(
      fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } }),
      TIMEOUT_MS,
    );
    return {
      name: "resend",
      status: r.ok ? "ok" : "fail",
      latency_ms: Math.round(performance.now() - t),
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { name: "resend", status: "fail", latency_ms: Math.round(performance.now() - t), detail: String(e) };
  }
}

/**
 * GET /api/health
 *
 * JSON 응답 — UptimeRobot·BetterUptime 외부 모니터링 + cron 자동 호출용.
 * 5개 외부 의존성 병렬 ping. 4초 timeout per check.
 *
 * status:
 *   "healthy"   — 모든 ok·skip
 *   "degraded"  — 일부 fail (서비스는 일부 동작)
 *   "unhealthy" — Supabase 또는 Anthropic fail (핵심 의존성)
 */
export async function GET(_request: NextRequest) {
  const start = performance.now();
  const checks = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
    checkGemini(),
    checkHeyGen(),
    checkUpstash(),
    checkResend(),
  ]);

  const critical = checks.filter((c) => c.name === "supabase" || c.name === "anthropic");
  // HeyGen·Resend는 비동기/fail-soft → degraded 판정에서 제외 (운영팀 노이즈 감소)
  const noisyFail = checks.some(
    (c) => c.status === "fail" && c.name !== "heygen" && c.name !== "resend",
  );
  const anyFail = noisyFail;
  const criticalFail = critical.some((c) => c.status === "fail");

  const status: "healthy" | "degraded" | "unhealthy" = criticalFail
    ? "unhealthy"
    : anyFail
      ? "degraded"
      : "healthy";

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      total_latency_ms: Math.round(performance.now() - start),
      checks,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      env: process.env.VERCEL_ENV ?? "development",
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } },
  );
}
