import type { SupabaseClient } from "@supabase/supabase-js";

// TEAM 1
import { ComprehensiveAnalysis, type AnalysisOutput } from "./team1-planning/comprehensive-analysis";
import { EnvironmentResearch, type EnvironmentResearchOutput } from "./team1-planning/environment-research";
import { TopicResearch, type TopicResearchOutput } from "./team1-planning/topic-research";
import { OutlineWriter, type OutlineOutput } from "./team1-planning/outline-writer";

// TEAM 2 (기존)
import { ContentCurator, type CuratorOutput, type CuratorInput } from "./team2/content-curator";
import { VisualPlanner, type PlannerOutput } from "./team2/visual-planner";

// TEAM 2-Production (신규)
import { LearningProcessCurator, type LearningProcessOutput } from "./team2-production/learning-process-curator";
import { InfographicDesigner, type InfographicOutput } from "./team2-production/infographic-designer";

// TEAM 4-Quality
import { Reviewer, type ReviewerOutput } from "./team4-quality/reviewer";
import { FormatChecker, type FormatCheckerOutput } from "./team4-quality/format-checker";
import { ComprehensiveReviewer, type ComprehensiveReviewerOutput } from "./team4-quality/comprehensive-reviewer";
import { FinalPolisher, type PolishedOutput } from "./team4-quality/final-polisher";

import { AgentError, type AgentLog } from "./base";
import { logCost } from "@/lib/cost-tracker";

export type StudioPlanning = {
  analysis: AnalysisOutput;
  environment: EnvironmentResearchOutput;
  topicResearch: TopicResearchOutput;
  outline: OutlineOutput;
};

export type Team2Production = {
  learning_sequence: LearningProcessOutput;
  curator: CuratorOutput;
  planner: PlannerOutput;
  infographics: InfographicOutput;
};

export type QualityResult = {
  reviewer: ReviewerOutput;
  format_checker: FormatCheckerOutput;
  comprehensive: ComprehensiveReviewerOutput;
  revise_count: number;
  polished?: PolishedOutput;
  error_message?: string;
};

export type FullChainResult = {
  planning: StudioPlanning;
  team2: Team2Production;
  quality: QualityResult;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Studio 전체 체인 (v0.10.0) — 12 에이전트 (⑨ 오케스트레이터 제외).
 *
 * 흐름:
 *   TEAM 1:  #01 → [#02 ‖ #03] → #04
 *   TEAM 2:  #05 → #06 → #07 → #08
 *   TEAM 4:  [#10 ‖ #11] → #12 → (조건부) #13
 *
 * 조건부 로직:
 *   #12 approve  → #13 실행 후 완료
 *   #12 revise   → #06~#08 재실행 (max 1회) → TEAM 4 재실행 → #13
 *   #12 reject   → status=completed + recommendation=reject (quality 탭에 사유 표시)
 */
export async function runFullChain(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  input: CuratorInput,
  model?: string,
): Promise<FullChainResult> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];
  let chainStep = 0;

  const pushLog = async (log: AgentLog) => {
    agent_logs.push(log);
    await supabase.from("studio_jobs").update({ agent_logs }).eq("id", jobId);
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
    // TEAM 2 — 실행 함수 (revise 시 재호출)
    // ══════════════════════════════════════════════════
    const runTeam2 = async (): Promise<Team2Production> => {
      const a05 = new LearningProcessCurator(model);
      const r05 = await a05.execute({ topic: input.topic, level: input.level, outline: r04.output });
      await pushLog(r05.log);
      await recordCost(r05.log, a05.id);

      const curatorInput: CuratorInput = { ...input, planning };
      const a06 = new ContentCurator(model);
      const r06 = await a06.execute(curatorInput);
      await pushLog(r06.log);
      await recordCost(r06.log, a06.id);

      const a07 = new VisualPlanner(model);
      const r07 = await a07.execute({ curated: r06.output });
      await pushLog(r07.log);
      await recordCost(r07.log, a07.id);

      const a08 = new InfographicDesigner(model);
      const r08 = await a08.execute({ slide_plan: r07.output, topic: input.topic, level: input.level });
      await pushLog(r08.log);
      await recordCost(r08.log, a08.id);

      return {
        learning_sequence: r05.output,
        curator: r06.output,
        planner: r07.output,
        infographics: r08.output,
      };
    };

    // ══════════════════════════════════════════════════
    // TEAM 4 — 실행 함수
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
    // 실행: TEAM 2 → TEAM 4 → 조건부 revise/approve/reject
    // ══════════════════════════════════════════════════
    let team2 = await runTeam2();
    let t4 = await runTeam4(team2);
    let reviseCount = 0;

    // revise: 1회 재시도
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

    // reject: 완료로 저장하되 quality 탭에 사유 표시
    if (t4.comprehensive.recommendation === "reject") {
      quality.error_message =
        "AI가 생성한 콘텐츠가 학습 목표를 충족하지 못했습니다. 다른 주제로 다시 시도하거나 수준을 조정해보세요.";

      const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
      const content = { planning, team2, quality };
      await supabase
        .from("studio_jobs")
        .update({
          status: "completed",
          content,
          agent_logs,
          cost_usd: totalCost,
          duration_seconds: (Date.now() - overallStart) / 1000,
        })
        .eq("id", jobId);

      return {
        planning,
        team2,
        quality,
        agent_logs,
        total_cost_usd: totalCost,
        total_duration_ms: Date.now() - overallStart,
      };
    }

    // approve (또는 revise 후 재심사): #13 최종 마감
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

    // 최종 산출물: 마감본 우선, 없으면 원본
    const finalTeam2: Team2Production = {
      learning_sequence: r13.output.learning_sequence ?? team2.learning_sequence,
      curator: r13.output.curator ?? team2.curator,
      planner: r13.output.planner ?? team2.planner,
      infographics: r13.output.infographics ?? team2.infographics,
    };

    const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
    const totalDurationMs = Date.now() - overallStart;

    // 기존 API 호환: content.curator, content.planner 유지
    const content = {
      planning,
      team2: finalTeam2,
      quality,
      curator: finalTeam2.curator,
      planner: finalTeam2.planner,
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
      team2: finalTeam2,
      quality,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof AgentError && err.partialLog) {
      const alreadyLogged = agent_logs.some(
        (l) => l.agent_id === (err as AgentError).partialLog!.agent_id && l.started_at === (err as AgentError).partialLog!.started_at,
      );
      if (!alreadyLogged) agent_logs.push((err as AgentError).partialLog!);
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
