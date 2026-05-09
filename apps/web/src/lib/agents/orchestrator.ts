import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentCurator, type CuratorInput, type CuratorOutput } from "./team2/content-curator";
import { VisualPlanner, type PlannerOutput } from "./team2/visual-planner";
import { AgentError, type AgentLog } from "./base";
import { logCost } from "@/lib/cost-tracker";

export type StudioChainResult = {
  curator: CuratorOutput;
  planner: PlannerOutput;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Studio 체인 실행기 — TEAM 2 첫 2단계.
 *
 * 흐름:
 *   1. studio_jobs UPDATE status='running'
 *   2. ContentCurator.execute() → curated
 *   3. agent_logs 추가 + studio_jobs UPDATE
 *   4. VisualPlanner.execute({ curated }) → slides
 *   5. agent_logs 추가 + 최종 content + status='completed' UPDATE
 *
 * 에러 처리:
 *   - 어느 단계에서든 실패하면 status='failed', error 컬럼에 메시지, agent_logs에 failed entry
 *   - 응답 흐름 X — 본 함수는 after() 콜백에서 호출되므로 사용자 응답에 영향 없음
 */
export async function runStudioChain(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  input: CuratorInput,
): Promise<StudioChainResult> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];

  // 1. 시작 표시
  await supabase
    .from("studio_jobs")
    .update({ status: "running", agent_logs: [] })
    .eq("id", jobId);

  try {
    // 2. ContentCurator
    const curator = new ContentCurator();
    const curatorRun = await curator.execute(input);
    agent_logs.push(curatorRun.log);

    await supabase
      .from("studio_jobs")
      .update({ agent_logs })
      .eq("id", jobId);

    await logCost({
      supabase,
      service: "anthropic",
      endpoint: "/api/studio/generate",
      userId,
      tokensIn: curatorRun.log.tokens_in,
      tokensOut: curatorRun.log.tokens_out,
      costUsd: curatorRun.log.cost_usd,
      metadata: { agent_id: curator.id, job_id: jobId, chain_step: 1 },
    });

    // 3. VisualPlanner
    const planner = new VisualPlanner();
    const plannerRun = await planner.execute({ curated: curatorRun.output });
    agent_logs.push(plannerRun.log);

    await logCost({
      supabase,
      service: "anthropic",
      endpoint: "/api/studio/generate",
      userId,
      tokensIn: plannerRun.log.tokens_in,
      tokensOut: plannerRun.log.tokens_out,
      costUsd: plannerRun.log.cost_usd,
      metadata: { agent_id: planner.id, job_id: jobId, chain_step: 2 },
    });

    // 4. 최종 저장
    const totalCost = curatorRun.log.cost_usd + plannerRun.log.cost_usd;
    const totalDurationMs = Date.now() - overallStart;
    const content = {
      curator: curatorRun.output,
      planner: plannerRun.output,
    };

    await supabase
      .from("studio_jobs")
      .update({
        status: "completed",
        content,
        agent_logs,
        cost_usd: totalCost,
        duration_seconds: totalDurationMs / 1000,
      })
      .eq("id", jobId);

    return {
      curator: curatorRun.output,
      planner: plannerRun.output,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 실패한 에이전트의 partial log를 agent_logs에 추가
    if (err instanceof AgentError && err.partialLog) {
      agent_logs.push(err.partialLog);
    }

    await supabase
      .from("studio_jobs")
      .update({
        status: "failed",
        error: message,
        agent_logs,
        duration_seconds: (Date.now() - overallStart) / 1000,
      })
      .eq("id", jobId);

    throw err;
  }
}
