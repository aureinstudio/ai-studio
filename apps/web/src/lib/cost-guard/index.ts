/**
 * Cost Guard — 다층 비용 한도 enforcement.
 *
 * 한도:
 *   per_user_daily     $5      학생 1인당 일일
 *   per_user_monthly   $50     학생 1인당 월간
 *   global_daily       $100    전체 일일
 *   global_monthly     $1000   전체 월간
 *   cast_user_daily    $2      Cast 솔루션별 (학생당)
 *   cast_global_daily  $30     Cast 솔루션별 (전역)
 *
 * 임계 동작:
 *   80% 도달 → admin 이메일 1회 (cost_alerts에 중복방지 mark)
 *   100% 도달 → 차단
 *
 * Override:
 *   admin은 항상 통과 (시연/테스트 목적)
 *   cost_overrides 테이블에 본부장 수동 해제 가능
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CostScope = "user" | "global";
export type CostWindow = "daily" | "monthly";
export type CostService = "all" | "cast";

export type CostLimitKey =
  | "per_user_daily"
  | "per_user_monthly"
  | "global_daily"
  | "global_monthly"
  | "cast_user_daily"
  | "cast_global_daily";

export const COST_LIMITS: Record<CostLimitKey, number> = {
  per_user_daily: Number(process.env.COST_USER_DAILY_USD ?? 5),
  per_user_monthly: Number(process.env.COST_USER_MONTHLY_USD ?? 50),
  global_daily: Number(process.env.COST_GLOBAL_DAILY_USD ?? 100),
  global_monthly: Number(process.env.COST_GLOBAL_MONTHLY_USD ?? 1000),
  cast_user_daily: Number(process.env.COST_CAST_USER_DAILY_USD ?? 2),
  cast_global_daily: Number(process.env.COST_CAST_GLOBAL_DAILY_USD ?? 30),
};

function startOfWindow(w: CostWindow): Date {
  const now = new Date();
  if (w === "daily") {
    now.setUTCHours(0, 0, 0, 0);
  } else {
    now.setUTCDate(1);
    now.setUTCHours(0, 0, 0, 0);
  }
  return now;
}

async function sumCost(
  supabase: SupabaseClient,
  opts: { userId?: string; service?: CostService; window: CostWindow },
): Promise<number> {
  const since = startOfWindow(opts.window).toISOString();
  let q = supabase.from("cost_log").select("cost_usd").gte("created_at", since);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.service === "cast") q = q.eq("service", "cast");
  const { data, error } = await q;
  if (error) {
    console.warn("[cost-guard] sum query failed:", error.message);
    return 0;
  }
  return (data ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
}

export type CostGuardResult = {
  allowed: boolean;
  reason?: string;
  breached?: CostLimitKey;
  current_usd: number;
  limit_usd: number;
  ratio: number;
  warnings: { key: CostLimitKey; ratio: number; current: number; limit: number }[];
  bypassed?: "admin";
};

/**
 * 비용 한도 검사 — 다층 OR (어떤 한도라도 초과 시 차단).
 *
 * service='cast' 호출 시 cast 전용 한도 + 전체 한도 모두 검사.
 * service='all' 호출 시 전체 한도만 검사.
 */
export async function checkCostBudget(
  supabase: SupabaseClient,
  params: {
    userId: string;
    service: CostService;
    isAdmin?: boolean;
  },
): Promise<CostGuardResult> {
  if (params.isAdmin) {
    return {
      allowed: true,
      current_usd: 0,
      limit_usd: 0,
      ratio: 0,
      warnings: [],
      bypassed: "admin",
    };
  }

  // 검사할 한도 묶음
  const checks: { key: CostLimitKey; getCur: () => Promise<number> }[] = [
    { key: "per_user_daily", getCur: () => sumCost(supabase, { userId: params.userId, window: "daily" }) },
    { key: "per_user_monthly", getCur: () => sumCost(supabase, { userId: params.userId, window: "monthly" }) },
    { key: "global_daily", getCur: () => sumCost(supabase, { window: "daily" }) },
    { key: "global_monthly", getCur: () => sumCost(supabase, { window: "monthly" }) },
  ];
  if (params.service === "cast") {
    checks.push(
      { key: "cast_user_daily", getCur: () => sumCost(supabase, { userId: params.userId, service: "cast", window: "daily" }) },
      { key: "cast_global_daily", getCur: () => sumCost(supabase, { service: "cast", window: "daily" }) },
    );
  }

  // 수동 해제 (override) 조회 — 활성 override 있으면 통과 (per-user 한도만 면제)
  const { data: overrides } = await supabase
    .from("cost_overrides")
    .select("scope_key")
    .eq("user_id", params.userId)
    .gte("expires_at", new Date().toISOString());
  const overrideKeys = new Set((overrides ?? []).map((o) => o.scope_key as CostLimitKey));

  const warnings: CostGuardResult["warnings"] = [];
  let breached: CostLimitKey | null = null;
  let breachedCur = 0;
  let breachedLim = 0;

  for (const c of checks) {
    if (overrideKeys.has(c.key)) continue;
    const lim = COST_LIMITS[c.key];
    if (lim <= 0) continue;
    const cur = await c.getCur();
    const ratio = cur / lim;
    if (ratio >= 1) {
      breached = c.key;
      breachedCur = cur;
      breachedLim = lim;
      break;
    }
    if (ratio >= 0.8) {
      warnings.push({ key: c.key, ratio, current: cur, limit: lim });
    }
  }

  if (breached) {
    return {
      allowed: false,
      reason: `${breached} 한도 초과: $${breachedCur.toFixed(2)} / $${breachedLim.toFixed(2)}`,
      breached,
      current_usd: breachedCur,
      limit_usd: breachedLim,
      ratio: breachedCur / breachedLim,
      warnings,
    };
  }

  return {
    allowed: true,
    current_usd: 0,
    limit_usd: 0,
    ratio: 0,
    warnings,
  };
}

/**
 * 80% 도달 시 admin 알림 — 중복 방지 위해 cost_alerts에 mark.
 * notifyAdmin은 호출처에서 별도 import (순환 회피 위해 콜백).
 */
export async function recordCostWarnings(
  supabase: SupabaseClient,
  userId: string,
  warnings: CostGuardResult["warnings"],
  notify: (title: string, body: string) => Promise<void>,
): Promise<void> {
  if (warnings.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  for (const w of warnings) {
    // 오늘 이미 같은 key·user로 알림했는지 확인
    const { data: existing } = await supabase
      .from("cost_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("scope_key", w.key)
      .eq("alert_date", today)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("cost_alerts").insert({
      user_id: userId,
      scope_key: w.key,
      alert_date: today,
      ratio: w.ratio,
      current_usd: w.current,
      limit_usd: w.limit,
    });

    await notify(
      `⚠️ 비용 한도 ${Math.floor(w.ratio * 100)}% 도달 — ${w.key}`,
      `사용자 ${userId.slice(0, 8)} · 현재 $${w.current.toFixed(2)} / 한도 $${w.limit.toFixed(2)}`,
    );
  }
}

/**
 * Response 헬퍼 — 402 Payment Required (비용 차단).
 */
export function costBlockResponse(result: CostGuardResult): Response {
  return new Response(
    JSON.stringify({
      error: "cost_limit_exceeded",
      message: result.reason,
      breached: result.breached,
      current_usd: result.current_usd,
      limit_usd: result.limit_usd,
    }),
    {
      status: 402,
      headers: { "Content-Type": "application/json" },
    },
  );
}
