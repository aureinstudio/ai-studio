import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAILY_USD_LIMIT,
  CAST_DAILY_LIMIT_USD,
} from "@/lib/limits";

/**
 * Meta Orchestrator — 3개 솔루션 전역 조율.
 *
 * 책임:
 *   - 솔루션별 일일 비용 추적·한도 확인
 *   - 전역 예산 잔여 계산
 *   - 솔루션 간 작업 우선순위 결정
 *   - 장애 시 우회 라우팅 (Phase 2)
 *
 * 본 모듈은 *경량 helper* — LLM 사용 X. 빠른 결정·라우팅.
 */

export type SolutionId = "studio" | "cast" | "tutor";

export type SolutionStatus = {
  solution: SolutionId;
  daily_spent_usd: number;
  daily_limit_usd: number;
  remaining_usd: number;
  percent_used: number;
  is_blocked: boolean;
};

export type MetaTask = {
  primary_solution: SolutionId;
  secondary_calls: { solution: SolutionId; when: string; condition: string }[];
  budget_limit_usd: number;
};

const TUTOR_DAILY_LIMIT_USD = Number(process.env.TUTOR_DAILY_LIMIT_USD ?? 20);

/**
 * 사용자의 오늘 사용 비용 (service별).
 */
export async function getDailyUsageBySolution(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<SolutionId, number>> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("cost_log")
    .select("service, cost_usd")
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString());

  const usage: Record<SolutionId, number> = { studio: 0, cast: 0, tutor: 0 };
  for (const row of data ?? []) {
    const cost = Number(row.cost_usd) || 0;
    if (row.service === "anthropic") usage.studio += cost;
    else if (row.service === "cast" || row.service === "elevenlabs" || row.service === "heygen") usage.cast += cost;
    else if (row.service === "tutor" || row.service === "gemini") usage.tutor += cost;
  }
  return usage;
}

/**
 * 솔루션별 상태 (Studio·Cast·Tutor).
 */
export async function getSolutionStatuses(
  supabase: SupabaseClient,
  userId: string,
): Promise<SolutionStatus[]> {
  const usage = await getDailyUsageBySolution(supabase, userId);
  const limits = {
    studio: DAILY_USD_LIMIT,
    cast: CAST_DAILY_LIMIT_USD,
    tutor: TUTOR_DAILY_LIMIT_USD,
  };

  return (["studio", "cast", "tutor"] as SolutionId[]).map((s) => ({
    solution: s,
    daily_spent_usd: usage[s],
    daily_limit_usd: limits[s],
    remaining_usd: Math.max(0, limits[s] - usage[s]),
    percent_used: (usage[s] / limits[s]) * 100,
    is_blocked: usage[s] >= limits[s],
  }));
}

/**
 * 전역 일일 한도 (3개 솔루션 합계 기반).
 */
export const GLOBAL_DAILY_LIMIT_USD =
  DAILY_USD_LIMIT + CAST_DAILY_LIMIT_USD + TUTOR_DAILY_LIMIT_USD;

/**
 * 작업 진행 가능 여부 판정.
 * - primary_solution이 차단 상태면 false
 * - 전역 한도 초과 시 false
 */
export async function canExecuteTask(
  supabase: SupabaseClient,
  userId: string,
  task: { solution: SolutionId; estimated_cost: number },
): Promise<{ allowed: boolean; reason?: string; status: SolutionStatus }> {
  const statuses = await getSolutionStatuses(supabase, userId);
  const target = statuses.find((s) => s.solution === task.solution)!;

  if (target.is_blocked) {
    return {
      allowed: false,
      reason: `${task.solution} 일일 한도 도달 ($${target.daily_spent_usd.toFixed(2)} / $${target.daily_limit_usd})`,
      status: target,
    };
  }

  if (target.daily_spent_usd + task.estimated_cost > target.daily_limit_usd) {
    return {
      allowed: false,
      reason: `예상 비용 $${task.estimated_cost.toFixed(2)} 추가 시 ${task.solution} 한도 초과`,
      status: target,
    };
  }

  return { allowed: true, status: target };
}

/**
 * 솔루션 간 호출 카운트 (최근 N일).
 * Phase 2: 별도 integration_events 테이블에 기록. 현재는 cost_log endpoint 패턴 추정.
 */
export async function getIntegrationCallCounts(
  supabase: SupabaseClient,
  days: number = 7,
): Promise<{
  tutor_to_cast: number;
  studio_to_cast: number;
  studio_to_tutor: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // cast_jobs.studio_job_id !== null → studio_to_cast
  const { count: studioToCast } = await supabase
    .from("cast_jobs")
    .select("id", { count: "exact", head: true })
    .not("studio_job_id", "is", null)
    .gte("created_at", since);

  // rag_embeddings 존재 → studio_to_tutor (인덱싱됨)
  const { data: indexed } = await supabase
    .from("rag_embeddings")
    .select("studio_job_id")
    .gte("created_at", since);
  const studioToTutor = new Set((indexed ?? []).map((r) => r.studio_job_id)).size;

  // tutor → cast realtime trigger는 metadata.tutor_origin이 있는 cast_jobs.mode='realtime'
  // 현재는 별도 추적 안 됨 → 0 반환 (Phase 2 별도 컬럼)
  return {
    tutor_to_cast: 0,
    studio_to_cast: studioToCast ?? 0,
    studio_to_tutor: studioToTutor,
  };
}
