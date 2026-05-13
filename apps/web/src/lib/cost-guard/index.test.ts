import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkCostBudget, COST_LIMITS } from "./index";

/**
 * 최소 Supabase 클라이언트 mock — sum 쿼리만 처리.
 * cost_log row 리스트를 시퀀셜로 반환 (각 .from().select().gte().eq() 체인 별로).
 */
function makeMockSupabase(costRows: { cost_usd: number }[][]) {
  let callIdx = 0;
  const builder: Record<string, unknown> = {
    select: () => builder,
    gte: () => builder,
    eq: () => builder,
    then: (resolve: (v: { data: { cost_usd: number }[] | null; error: null }) => unknown) =>
      resolve({ data: costRows[callIdx++] ?? [], error: null }),
  };
  return {
    from: (table: string) => {
      if (table === "cost_overrides") {
        // 항상 override 없음
        return {
          select: () => ({
            eq: () => ({
              gte: () =>
                Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("cost-guard — checkCostBudget", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("admin은 항상 통과", async () => {
    const supabase = makeMockSupabase([]);
    const r = await checkCostBudget(supabase, {
      userId: "u-1",
      service: "all",
      isAdmin: true,
    });
    expect(r.allowed).toBe(true);
    expect(r.bypassed).toBe("admin");
  });

  it("모든 한도 미달 — 통과", async () => {
    // user_daily=$1, user_monthly=$2, global_daily=$3, global_monthly=$4
    const supabase = makeMockSupabase([
      [{ cost_usd: 1.0 }],
      [{ cost_usd: 2.0 }],
      [{ cost_usd: 3.0 }],
      [{ cost_usd: 4.0 }],
    ]);
    const r = await checkCostBudget(supabase, { userId: "u-1", service: "all" });
    expect(r.allowed).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("per_user_daily 한도 초과 시 차단", async () => {
    const userDaily = COST_LIMITS.per_user_daily; // 기본 5
    const supabase = makeMockSupabase([
      [{ cost_usd: userDaily + 1 }], // user_daily 초과
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
    ]);
    const r = await checkCostBudget(supabase, { userId: "u-1", service: "all" });
    expect(r.allowed).toBe(false);
    expect(r.breached).toBe("per_user_daily");
  });

  it("80%~99% 도달 시 warnings 발생 (allowed=true)", async () => {
    const userDaily = COST_LIMITS.per_user_daily;
    const supabase = makeMockSupabase([
      [{ cost_usd: userDaily * 0.9 }], // 90%
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
    ]);
    const r = await checkCostBudget(supabase, { userId: "u-1", service: "all" });
    expect(r.allowed).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0].key).toBe("per_user_daily");
    expect(r.warnings[0].ratio).toBeGreaterThanOrEqual(0.8);
  });

  it("service=cast 호출 시 cast 전용 한도도 체크", async () => {
    // 일반 한도는 모두 0, cast 한도만 초과
    const castUserDaily = COST_LIMITS.cast_user_daily; // 기본 2
    const supabase = makeMockSupabase([
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: castUserDaily + 0.5 }], // cast_user_daily 초과
      [{ cost_usd: 0 }],
    ]);
    const r = await checkCostBudget(supabase, { userId: "u-1", service: "cast" });
    expect(r.allowed).toBe(false);
    expect(r.breached).toBe("cast_user_daily");
  });

  it("정확히 한도값 도달 시 차단 (ratio>=1)", async () => {
    const userDaily = COST_LIMITS.per_user_daily;
    const supabase = makeMockSupabase([
      [{ cost_usd: userDaily }], // 100%
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
      [{ cost_usd: 0 }],
    ]);
    const r = await checkCostBudget(supabase, { userId: "u-1", service: "all" });
    expect(r.allowed).toBe(false);
  });
});
