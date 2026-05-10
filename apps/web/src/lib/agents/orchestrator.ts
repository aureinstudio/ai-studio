import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ComprehensiveAnalysis,
  type AnalysisOutput,
} from "./team1-planning/comprehensive-analysis";
import {
  EnvironmentResearch,
  type EnvironmentResearchOutput,
} from "./team1-planning/environment-research";
import {
  TopicResearch,
  type TopicResearchOutput,
} from "./team1-planning/topic-research";
import { OutlineWriter, type OutlineOutput } from "./team1-planning/outline-writer";
import {
  ContentCurator,
  type CuratorInput,
  type CuratorOutput,
} from "./team2/content-curator";
import { VisualPlanner, type PlannerOutput } from "./team2/visual-planner";
import { AgentError, type AgentLog } from "./base";
import { logCost } from "@/lib/cost-tracker";

export type StudioPlanning = {
  analysis: AnalysisOutput;
  environment: EnvironmentResearchOutput;
  topicResearch: TopicResearchOutput;
  outline: OutlineOutput;
};

export type StudioChainResult = {
  planning: StudioPlanning;
  curator: CuratorOutput;
  planner: PlannerOutput;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Studio 6-에이전트 체인 (v0.9.0).
 *
 * 흐름:
 *   Stage 1: #01 종합 분석 (input → analysis)
 *   Stage 2: #02 환경 조사 + #03 주제 조사 *병렬* (analysis → env, topicResearch)
 *   Stage 3: #04 개요 작성 (analysis + env + topic → outline)
 *   Stage 4: #06 핵심 자료 큐레이터 (planning + input → curator)
 *   Stage 5: #07 시각 디자인 기획 (curator → planner)
 *
 * 각 단계마다 agent_logs DB 업데이트 → 클라이언트 polling이 실시간 반영.
 * 병렬 단계는 두 결과 모두 도착 후 동시 push (순서는 완료 시점).
 */
export async function runStudioChain(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  input: CuratorInput,
  model?: string,
): Promise<StudioChainResult> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];

  // 진행 상황 DB 업데이트 헬퍼
  const pushLog = async (log: AgentLog) => {
    agent_logs.push(log);
    await supabase
      .from("studio_jobs")
      .update({ agent_logs })
      .eq("id", jobId);
  };

  const recordCost = async (log: AgentLog, step: number, agentId: string) => {
    await logCost({
      supabase,
      service: "anthropic",
      endpoint: "/api/studio/generate",
      userId,
      tokensIn: log.tokens_in,
      tokensOut: log.tokens_out,
      costUsd: log.cost_usd,
      metadata: { agent_id: agentId, job_id: jobId, chain_step: step },
    });
  };

  // 시작 표시
  await supabase
    .from("studio_jobs")
    .update({ status: "running", agent_logs: [] })
    .eq("id", jobId);

  try {
    // ─── Stage 1: #01 종합 분석 ─────────────────────────────────
    const analysisAgent = new ComprehensiveAnalysis(model);
    const analysisRun = await analysisAgent.execute({
      topic: input.topic,
      level: input.level,
      length: input.length,
    });
    await pushLog(analysisRun.log);
    await recordCost(analysisRun.log, 1, analysisAgent.id);

    // ─── Stage 2: #02 + #03 병렬 ──────────────────────────────
    const envAgent = new EnvironmentResearch(model);
    const topicAgent = new TopicResearch(model);

    const [envSettled, topicSettled] = await Promise.allSettled([
      envAgent.execute({
        topic: input.topic,
        target_learners: analysisRun.output.target_learners,
      }),
      topicAgent.execute({
        topic: input.topic,
        learning_objective_tree: analysisRun.output.learning_objective_tree,
      }),
    ]);

    // 둘 중 하나라도 실패하면 partial log push 후 throw
    if (envSettled.status === "rejected") {
      if (envSettled.reason instanceof AgentError && envSettled.reason.partialLog) {
        await pushLog(envSettled.reason.partialLog);
      }
      throw envSettled.reason;
    }
    if (topicSettled.status === "rejected") {
      // env 성공한 경우에만 그 log push
      if (envSettled.status === "fulfilled") {
        await pushLog(envSettled.value.log);
        await recordCost(envSettled.value.log, 2, envAgent.id);
      }
      if (topicSettled.reason instanceof AgentError && topicSettled.reason.partialLog) {
        await pushLog(topicSettled.reason.partialLog);
      }
      throw topicSettled.reason;
    }

    // 둘 다 성공 — 완료 시점 순서로 push (env가 보통 더 빠름, topic은 조금 늦을 수 있음)
    const envRun = envSettled.value;
    const topicRun = topicSettled.value;
    await pushLog(envRun.log);
    await recordCost(envRun.log, 2, envAgent.id);
    await pushLog(topicRun.log);
    await recordCost(topicRun.log, 3, topicAgent.id);

    // ─── Stage 3: #04 개요 작성 ─────────────────────────────────
    const outlineAgent = new OutlineWriter(model);
    const outlineRun = await outlineAgent.execute({
      analysis: analysisRun.output,
      environment: envRun.output,
      topicResearch: topicRun.output,
    });
    await pushLog(outlineRun.log);
    await recordCost(outlineRun.log, 4, outlineAgent.id);

    const planning: StudioPlanning = {
      analysis: analysisRun.output,
      environment: envRun.output,
      topicResearch: topicRun.output,
      outline: outlineRun.output,
    };

    // ─── Stage 4: #06 큐레이터 ────────────────────────────────
    const curator = new ContentCurator(model);
    const curatorRun = await curator.execute({
      ...input,
      planning,
    });
    await pushLog(curatorRun.log);
    await recordCost(curatorRun.log, 5, curator.id);

    // ─── Stage 5: #07 시각 디자인 기획 ─────────────────────────
    const planner = new VisualPlanner(model);
    const plannerRun = await planner.execute({ curated: curatorRun.output });
    await pushLog(plannerRun.log);
    await recordCost(plannerRun.log, 6, planner.id);

    // 최종 저장
    const totalCost = agent_logs.reduce((sum, l) => sum + l.cost_usd, 0);
    const totalDurationMs = Date.now() - overallStart;
    const content = {
      planning,
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
      planning,
      curator: curatorRun.output,
      planner: plannerRun.output,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof AgentError && err.partialLog) {
      // 위 흐름에서 이미 push 됐는지 확인 — 중복 방지
      const alreadyLogged = agent_logs.some(
        (l) =>
          l.agent_id === err.partialLog!.agent_id &&
          l.started_at === err.partialLog!.started_at,
      );
      if (!alreadyLogged) {
        agent_logs.push(err.partialLog);
      }
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
