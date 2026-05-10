import type { SupabaseClient } from "@supabase/supabase-js";

// TEAM 3
import { StudioOrchestrator, type OrchestratorPlan } from "./team3-orchestration/orchestrator";

// TEAM 1
import { ComprehensiveAnalysis } from "./team1-planning/comprehensive-analysis";
import { EnvironmentResearch } from "./team1-planning/environment-research";
import { TopicResearch } from "./team1-planning/topic-research";
import { OutlineWriter } from "./team1-planning/outline-writer";

// TEAM 2
import { ContentCurator, type CuratorInput, type CuratorOutput } from "./team2/content-curator";
import { VisualPlanner, type PlannerOutput } from "./team2/visual-planner";

// TEAM 2-Production
import { LearningProcessCurator, type LearningProcessOutput } from "./team2-production/learning-process-curator";
import { InfographicDesigner, type InfographicOutput } from "./team2-production/infographic-designer";

// TEAM 4
import { Reviewer, type ReviewerOutput } from "./team4-quality/reviewer";
import { FormatChecker, type FormatCheckerOutput } from "./team4-quality/format-checker";
import { ComprehensiveReviewer, type ComprehensiveReviewerOutput } from "./team4-quality/comprehensive-reviewer";
import { FinalPolisher, type PolishedOutput } from "./team4-quality/final-polisher";

import { AgentError, type AgentLog } from "./base";
import { logCost } from "@/lib/cost-tracker";
import type { StudioPlanning, Team2Production, QualityResult } from "./orchestrator-full";

export type DynamicChainResult = {
  plan: OrchestratorPlan;
  planning: StudioPlanning;
  team2: Team2Production;
  quality: QualityResult;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Studio 동적 체인 (v0.11.0) — 13 에이전트.
 *
 * 흐름:
 *   #09 오케스트레이터 → 실행 계획 수립
 *   TEAM 1: #01 → [#02 ‖ #03] → #04
 *   TEAM 2: (#05?) → #06 → #07 → (#08?)
 *   TEAM 4: [#10 ‖ #11] → #12 → (approve→#13 / revise→재실행 1회 / reject→완료)
 *
 * #09의 skipped_agents에 따라 #05, #08 스킵 가능.
 * 스킵된 에이전트는 "skipped" 상태로 로그 기록.
 */
export async function runDynamicChain(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  input: CuratorInput,
  model?: string,
): Promise<DynamicChainResult> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];
  let chainStep = 0;

  const pushLog = async (log: AgentLog) => {
    agent_logs.push(log);
    await supabase.from("studio_jobs").update({ agent_logs }).eq("id", jobId);
  };

  const pushSkippedLog = async (agentId: string, agentName: string, reason: string) => {
    const now = new Date().toISOString();
    const log: AgentLog = {
      agent_id: agentId,
      agent_name: agentName,
      status: "skipped" as AgentLog["status"],
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: `스킵: ${reason}`,
    };
    await pushLog(log);
  };

  const recordCost = async (log: AgentLog, agentId: string) => {
    chainStep++;
    await logCost({
      supabase,
      service: "anthropic",
      endpoint: "/api/studio/generate",
      userId,
      tokensIn: log.tokens_in,
      tokensOut: log.tokens_out,
      costUsd: log.cost_usd,
      metadata: { agent_id: agentId, job_id: jobId, chain_step: chainStep },
    });
  };

  await supabase
    .from("studio_jobs")
    .update({ status: "running", agent_logs: [] })
    .eq("id", jobId);

  try {
    // ══════════════════════════════════════════════════
    // TEAM 3: #09 오케스트레이터 — 실행 계획 수립
    // ══════════════════════════════════════════════════
    const a09 = new StudioOrchestrator(model);
    const r09 = await a09.execute({
      topic: input.topic,
      level: input.level,
      length: input.length,
    });
    await pushLog(r09.log);
    await recordCost(r09.log, a09.id);

    const plan = r09.output;
    const skipped = new Set(plan.skipped_agents ?? []);

    // ══════════════════════════════════════════════════
    // TEAM 1
    // ══════════════════════════════════════════════════
    const a01 = new ComprehensiveAnalysis(model);
    const r01 = await a01.execute({ topic: input.topic, level: input.level, length: input.length });
    await pushLog(r01.log);
    await recordCost(r01.log, a01.id);

    const a02 = new EnvironmentResearch(model);
    const a03 = new TopicResearch(model);
    const [s02, s03] = await Promise.allSettled([
      a02.execute({ topic: input.topic, target_learners: r01.output.target_learners }),
      a03.execute({ topic: input.topic, learning_objective_tree: r01.output.learning_objective_tree }),
    ]);

    if (s02.status === "rejected") {
      if (s02.reason instanceof AgentError && s02.reason.partialLog) await pushLog(s02.reason.partialLog);
      throw s02.reason;
    }
    if (s03.status === "rejected") {
      await pushLog(s02.value.log);
      await recordCost(s02.value.log, a02.id);
      if (s03.reason instanceof AgentError && s03.reason.partialLog) await pushLog(s03.reason.partialLog);
      throw s03.reason;
    }
    await pushLog(s02.value.log);
    await recordCost(s02.value.log, a02.id);
    await pushLog(s03.value.log);
    await recordCost(s03.value.log, a03.id);

    const a04 = new OutlineWriter(model);
    const r04 = await a04.execute({
      analysis: r01.output,
      environment: s02.value.output,
      topicResearch: s03.value.output,
    });
    await pushLog(r04.log);
    await recordCost(r04.log, a04.id);

    const planning: StudioPlanning = {
      analysis: r01.output,
      environment: s02.value.output,
      topicResearch: s03.value.output,
      outline: r04.output,
    };

    // ══════════════════════════════════════════════════
    // TEAM 2 실행 함수 (revise 시 재호출)
    // ══════════════════════════════════════════════════
    const runTeam2 = async (): Promise<Team2Production> => {
      // #05 — 조건부 실행
      let learning_sequence: LearningProcessOutput | null = null;
      if (skipped.has("studio-05")) {
        await pushSkippedLog("studio-05", "학습프로세스 큐레이터", plan.skip_reasons?.["studio-05"] ?? "오케스트레이터 결정");
        learning_sequence = { learning_sequence: [], difficulty_progression: "linear", engagement_techniques: [] };
      } else {
        const a05 = new LearningProcessCurator(model);
        const r05 = await a05.execute({ topic: input.topic, level: input.level, outline: r04.output });
        await pushLog(r05.log);
        await recordCost(r05.log, a05.id);
        learning_sequence = r05.output;
      }

      const a06 = new ContentCurator(model);
      const r06 = await a06.execute({ ...input, planning });
      await pushLog(r06.log);
      await recordCost(r06.log, a06.id);

      const a07 = new VisualPlanner(model);
      const r07 = await a07.execute({ curated: r06.output });
      await pushLog(r07.log);
      await recordCost(r07.log, a07.id);

      // #08 — 조건부 실행
      let infographics: InfographicOutput;
      if (skipped.has("studio-08")) {
        await pushSkippedLog("studio-08", "인포그래픽 디자이너", plan.skip_reasons?.["studio-08"] ?? "오케스트레이터 결정");
        infographics = { infographics: [] };
      } else {
        const a08 = new InfographicDesigner(model);
        const r08 = await a08.execute({ slide_plan: r07.output, topic: input.topic, level: input.level });
        await pushLog(r08.log);
        await recordCost(r08.log, a08.id);
        infographics = r08.output;
      }

      return {
        learning_sequence: learning_sequence!,
        curator: r06.output,
        planner: r07.output,
        infographics,
      };
    };

    // ══════════════════════════════════════════════════
    // TEAM 4 실행 함수
    // ══════════════════════════════════════════════════
    const runTeam4 = async (team2: Team2Production): Promise<{
      reviewer: ReviewerOutput;
      format_checker: FormatCheckerOutput;
      comprehensive: ComprehensiveReviewerOutput;
    }> => {
      const a10 = new Reviewer(model);
      const a11 = new FormatChecker(model);
      const [s10, s11] = await Promise.allSettled([
        a10.execute({
          learning_sequence: team2.learning_sequence,
          content: team2.curator,
          slide_plan: team2.planner,
          infographics: team2.infographics,
          topic: input.topic,
        }),
        a11.execute({
          learning_sequence: team2.learning_sequence,
          content: team2.curator,
          slide_plan: team2.planner,
          infographics: team2.infographics,
        }),
      ]);

      if (s10.status === "rejected") {
        if (s10.reason instanceof AgentError && s10.reason.partialLog) await pushLog(s10.reason.partialLog);
        throw s10.reason;
      }
      if (s11.status === "rejected") {
        await pushLog(s10.value.log);
        await recordCost(s10.value.log, a10.id);
        if (s11.reason instanceof AgentError && s11.reason.partialLog) await pushLog(s11.reason.partialLog);
        throw s11.reason;
      }
      await pushLog(s10.value.log);
      await recordCost(s10.value.log, a10.id);
      await pushLog(s11.value.log);
      await recordCost(s11.value.log, a11.id);

      const a12 = new ComprehensiveReviewer(model);
      const r12 = await a12.execute({
        reviewer_result: s10.value.output,
        format_checker_result: s11.value.output,
        original_objectives: r01.output.learning_objective_tree,
        topic: input.topic,
      });
      await pushLog(r12.log);
      await recordCost(r12.log, a12.id);

      return {
        reviewer: s10.value.output,
        format_checker: s11.value.output,
        comprehensive: r12.output,
      };
    };

    // ══════════════════════════════════════════════════
    // 실행: TEAM 2 → TEAM 4 → 조건부 분기
    // ══════════════════════════════════════════════════
    let team2 = await runTeam2();
    let t4 = await runTeam4(team2);
    let reviseCount = 0;

    if (t4.comprehensive.recommendation === "revise") {
      reviseCount = 1;
      team2 = await runTeam2();
      t4 = await runTeam4(team2);
    }

    const quality: QualityResult = {
      reviewer: t4.reviewer,
      format_checker: t4.format_checker,
      comprehensive: t4.comprehensive,
      revise_count: reviseCount,
    };

    if (t4.comprehensive.recommendation === "reject") {
      quality.error_message =
        "AI가 생성한 콘텐츠가 학습 목표를 충족하지 못했습니다. 다른 주제로 다시 시도하거나 수준을 조정해보세요.";
      const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
      const content = { planning, team2, quality, plan, curator: team2.curator, planner: team2.planner };
      await supabase.from("studio_jobs")
        .update({ status: "completed", content, agent_logs, cost_usd: totalCost, duration_seconds: (Date.now() - overallStart) / 1000 })
        .eq("id", jobId);
      return { plan, planning, team2, quality, agent_logs, total_cost_usd: totalCost, total_duration_ms: Date.now() - overallStart };
    }

    // approve: #13 최종 마감
    const a13 = new FinalPolisher(model);
    const r13 = await a13.execute({
      learning_sequence: team2.learning_sequence,
      curator: team2.curator,
      planner: team2.planner,
      infographics: team2.infographics,
      topic: input.topic,
    });
    await pushLog(r13.log);
    await recordCost(r13.log, a13.id);
    quality.polished = r13.output;

    const finalTeam2: Team2Production = {
      learning_sequence: r13.output.learning_sequence ?? team2.learning_sequence,
      curator: r13.output.curator ?? team2.curator,
      planner: r13.output.planner ?? team2.planner,
      infographics: r13.output.infographics ?? team2.infographics,
    };

    const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
    const totalDurationMs = Date.now() - overallStart;
    const content = {
      planning,
      team2: finalTeam2,
      quality,
      plan,
      curator: finalTeam2.curator,
      planner: finalTeam2.planner,
    };

    await supabase.from("studio_jobs")
      .update({ status: "completed", content, agent_logs, cost_usd: totalCost, duration_seconds: totalDurationMs / 1000 })
      .eq("id", jobId);

    return { plan, planning, team2: finalTeam2, quality, agent_logs, total_cost_usd: totalCost, total_duration_ms: totalDurationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof AgentError && err.partialLog) {
      const alreadyLogged = agent_logs.some(
        (l) => l.agent_id === (err as AgentError).partialLog!.agent_id && l.started_at === (err as AgentError).partialLog!.started_at,
      );
      if (!alreadyLogged) agent_logs.push((err as AgentError).partialLog!);
    }
    await supabase.from("studio_jobs")
      .update({ status: "failed", error: message, agent_logs, duration_seconds: (Date.now() - overallStart) / 1000 })
      .eq("id", jobId);
    throw err;
  }
}
