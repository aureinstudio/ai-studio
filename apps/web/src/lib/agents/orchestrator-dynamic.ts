import type { SupabaseClient } from "@supabase/supabase-js";

// TEAM 3
import { StudioOrchestrator } from "./team3-orchestration/orchestrator";

// TEAM 1
import { ComprehensiveAnalysis } from "./team1-planning/comprehensive-analysis";
import { EnvironmentResearch } from "./team1-planning/environment-research";
import { TopicResearch } from "./team1-planning/topic-research";
import { OutlineWriter } from "./team1-planning/outline-writer";

// TEAM 2
import { ContentCurator, type CuratorInput } from "./team2/content-curator";
import { VisualPlanner } from "./team2/visual-planner";

// TEAM 2-Production
import { LearningProcessCurator, type LearningProcessOutput } from "./team2-production/learning-process-curator";
import { InfographicDesigner, type InfographicOutput } from "./team2-production/infographic-designer";

// TEAM 4
import { Reviewer, type ReviewerOutput } from "./team4-quality/reviewer";
import { FormatChecker, type FormatCheckerOutput } from "./team4-quality/format-checker";
import { ComprehensiveReviewer, type ComprehensiveReviewerOutput } from "./team4-quality/comprehensive-reviewer";
import { FinalPolisher } from "./team4-quality/final-polisher";

import { Agent, AgentError, type AgentLog } from "./base";
import { logCost } from "@/lib/cost-tracker";
import type { StudioPlanning, Team2Production, QualityResult } from "./orchestrator-full";
import type { OrchestratorPlan } from "./team3-orchestration/orchestrator";

export type DynamicChainResult = {
  plan: OrchestratorPlan;
  planning: StudioPlanning;
  team2: Team2Production;
  quality: QualityResult;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

const SKIP_13_SCORE_THRESHOLD = 90;

/**
 * Studio 동적 체인 (v0.12.0).
 *
 * 흐름:
 *   #09 → #01 → [#02 ‖ #03] → #04
 *        → [#05 ‖ (#06 → #07 → #08)]   ← #05 병렬화 (이전: 순차)
 *        → [#10 ‖ #11] → #12
 *        → score≥90 ? skip #13 : run #13   ← #13 조건부 스킵
 *
 * 모든 에이전트 호출은 streaming + started/completed 로그 lifecycle.
 * UI는 진행 중 토큰 카운트를 실시간 표시 가능.
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

  const persistLogs = async () => {
    await supabase.from("studio_jobs").update({ agent_logs }).eq("id", jobId);
  };

  const pushSkippedLog = async (agentId: string, agentName: string, reason: string) => {
    const now = new Date().toISOString();
    agent_logs.push({
      agent_id: agentId,
      agent_name: agentName,
      status: "skipped",
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: `스킵: ${reason}`,
    });
    await persistLogs();
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

  /**
   * 에이전트 실행 + 진행 로그 lifecycle.
   * - 실행 직전: status="started" 로그 push (UI에서 펄스)
   * - 스트리밍 중: tokens_out을 throttle 업데이트 (1.5s 간격)
   * - 완료: started 로그를 completed 로그로 교체 + cost 기록
   * - 실패: started 로그를 failed 로그로 교체 + throw
   */
  const runWithProgress = async <I, O>(
    agent: Agent<I, O>,
    input: I,
  ): Promise<{ output: O; log: AgentLog }> => {
    const startedAt = new Date().toISOString();
    const startedLog: AgentLog = {
      agent_id: agent.id,
      agent_name: agent.name,
      status: "started",
      started_at: startedAt,
      completed_at: startedAt,
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
    };
    agent_logs.push(startedLog);
    await persistLogs();

    try {
      const result = await agent.execute(input, {
        onProgress: async (tokensOut) => {
          startedLog.tokens_out = tokensOut;
          await persistLogs();
        },
      });
      const idx = agent_logs.indexOf(startedLog);
      if (idx >= 0) agent_logs[idx] = result.log;
      await persistLogs();
      await recordCost(result.log, agent.id);
      return result;
    } catch (err) {
      const idx = agent_logs.indexOf(startedLog);
      if (idx >= 0 && err instanceof AgentError && err.partialLog) {
        agent_logs[idx] = err.partialLog;
      } else if (idx >= 0) {
        agent_logs[idx] = { ...startedLog, status: "failed", error: String(err) };
      }
      await persistLogs();
      throw err;
    }
  };

  await supabase
    .from("studio_jobs")
    .update({ status: "running", agent_logs: [] })
    .eq("id", jobId);

  try {
    // ── #09 오케스트레이터 ─────────────────────────────
    const r09 = await runWithProgress(new StudioOrchestrator(model), {
      topic: input.topic,
      level: input.level,
      length: input.length,
    });
    const plan = r09.output;
    const skipped = new Set(plan.skipped_agents ?? []);

    // ── TEAM 1 ────────────────────────────────────────
    const r01 = await runWithProgress(new ComprehensiveAnalysis(model), {
      topic: input.topic,
      level: input.level,
      length: input.length,
    });

    const [s02, s03] = await Promise.allSettled([
      runWithProgress(new EnvironmentResearch(model), {
        topic: input.topic,
        target_learners: r01.output.target_learners,
      }),
      runWithProgress(new TopicResearch(model), {
        topic: input.topic,
        learning_objective_tree: r01.output.learning_objective_tree,
      }),
    ]);
    if (s02.status === "rejected") throw s02.reason;
    if (s03.status === "rejected") throw s03.reason;

    const r04 = await runWithProgress(new OutlineWriter(model), {
      analysis: r01.output,
      environment: s02.value.output,
      topicResearch: s03.value.output,
    });

    const planning: StudioPlanning = {
      analysis: r01.output,
      environment: s02.value.output,
      topicResearch: s03.value.output,
      outline: r04.output,
    };

    // ══════════════════════════════════════════════════
    // TEAM 2: #05 ‖ (#06 → #07 → #08)
    // ══════════════════════════════════════════════════
    const runTeam2 = async (): Promise<Team2Production> => {
      // Lane A: #05 (혹은 스킵)
      const laneA: Promise<LearningProcessOutput> = skipped.has("studio-05")
        ? (async () => {
            await pushSkippedLog(
              "studio-05",
              "학습프로세스 큐레이터",
              plan.skip_reasons?.["studio-05"] ?? "오케스트레이터 결정",
            );
            return { learning_sequence: [], difficulty_progression: "linear", engagement_techniques: [] };
          })()
        : runWithProgress(new LearningProcessCurator(model), {
            topic: input.topic,
            level: input.level,
            outline: r04.output,
          }).then((r) => r.output);

      // Lane B: #06 → #07 → #08 (순차)
      const laneB = (async () => {
        const r06 = await runWithProgress(new ContentCurator(model), { ...input, planning });
        const r07 = await runWithProgress(new VisualPlanner(model), { curated: r06.output });
        const infographics: InfographicOutput = skipped.has("studio-08")
          ? await (async () => {
              await pushSkippedLog(
                "studio-08",
                "인포그래픽 디자이너",
                plan.skip_reasons?.["studio-08"] ?? "오케스트레이터 결정",
              );
              return { infographics: [] };
            })()
          : await (async () => {
              try {
                const r08 = await runWithProgress(new InfographicDesigner(model), {
                  slide_plan: r07.output,
                  topic: input.topic,
                  level: input.level,
                });
                return r08.output;
              } catch (err) {
                // 비핵심 — 실패해도 본문은 사용 가능. 폴백: 빈 인포그래픽
                console.warn("[studio-08] failed, using empty fallback:", err);
                return { infographics: [] };
              }
            })();
        return { curator: r06.output, planner: r07.output, infographics };
      })();

      const [learning_sequence, contentResult] = await Promise.all([laneA, laneB]);
      return { learning_sequence, ...contentResult };
    };

    // ══════════════════════════════════════════════════
    // TEAM 4: [#10 ‖ #11] → #12 — 모두 fail-soft (검증 실패가 본문 생성 무효화 X)
    // ══════════════════════════════════════════════════
    const runTeam4 = async (
      team2: Team2Production,
    ): Promise<{
      reviewer: ReviewerOutput;
      format_checker: FormatCheckerOutput;
      comprehensive: ComprehensiveReviewerOutput;
    }> => {
      const [s10, s11] = await Promise.allSettled([
        runWithProgress(new Reviewer(model), {
          learning_sequence: team2.learning_sequence,
          content: team2.curator,
          slide_plan: team2.planner,
          infographics: team2.infographics,
          topic: input.topic,
        }),
        runWithProgress(new FormatChecker(model), {
          learning_sequence: team2.learning_sequence,
          content: team2.curator,
          slide_plan: team2.planner,
          infographics: team2.infographics,
        }),
      ]);

      const reviewer: ReviewerOutput =
        s10.status === "fulfilled"
          ? s10.value.output
          : {
              factual_accuracy: { score: 70, issues: [`#10 검토 실패: ${String(s10.reason).slice(0, 200)}`] },
              consistency: { score: 70, issues: [] },
              completeness: { score: 70, missing_elements: [] },
              overall_pass: true,
            };

      const format_checker: FormatCheckerOutput =
        s11.status === "fulfilled"
          ? s11.value.output
          : {
              structural_compliance: { score: 70, violations: [] },
              naming_conventions: { score: 70, violations: [] },
              metadata_completeness: { score: 70, missing: [] },
              auto_fixable_issues: [],
              manual_review_required: [`#11 형식 확인 실패: ${String(s11.reason).slice(0, 200)}`],
              overall_pass: true,
            };

      let comprehensive: ComprehensiveReviewerOutput;
      try {
        const r12 = await runWithProgress(new ComprehensiveReviewer(model), {
          reviewer_result: reviewer,
          format_checker_result: format_checker,
          original_objectives: r01.output.learning_objective_tree,
          topic: input.topic,
        });
        comprehensive = r12.output;
      } catch (err) {
        console.warn("[studio-12] failed, using fallback approve:", err);
        comprehensive = {
          objective_coverage: [],
          overall_alignment_score: 75,
          strengths: [],
          weaknesses: [`#12 종합 검토 실패: ${err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)}`],
          recommendation: "approve",
        };
      }

      return { reviewer, format_checker, comprehensive };
    };

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

    // reject: 완료(failed 아님) + quality 탭에 사유 표시
    if (t4.comprehensive.recommendation === "reject") {
      quality.error_message =
        "AI가 생성한 콘텐츠가 학습 목표를 충족하지 못했습니다. 다른 주제로 다시 시도하거나 수준을 조정해보세요.";
      const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
      const content = { planning, team2, quality, plan, curator: team2.curator, planner: team2.planner };
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
      return { plan, planning, team2, quality, agent_logs, total_cost_usd: totalCost, total_duration_ms: Date.now() - overallStart };
    }

    // ── #13 조건부 스킵: 점수 ≥ 90이면 마감 생략 ─────────────
    // 실패해도 fail-soft — 마감 안 된 원본 사용
    let finalTeam2: Team2Production = team2;
    if (t4.comprehensive.overall_alignment_score >= SKIP_13_SCORE_THRESHOLD) {
      await pushSkippedLog(
        "studio-13",
        "최종 품질 최적화",
        `종합 점수 ${t4.comprehensive.overall_alignment_score} ≥ ${SKIP_13_SCORE_THRESHOLD} — 마감 불필요`,
      );
    } else {
      try {
        const r13 = await runWithProgress(new FinalPolisher(model), {
          learning_sequence: team2.learning_sequence,
          curator: team2.curator,
          planner: team2.planner,
          infographics: team2.infographics,
          topic: input.topic,
        });
        quality.polished = r13.output;
        finalTeam2 = {
          learning_sequence: r13.output.learning_sequence ?? team2.learning_sequence,
          curator: r13.output.curator ?? team2.curator,
          planner: r13.output.planner ?? team2.planner,
          infographics: r13.output.infographics ?? team2.infographics,
        };
      } catch (err) {
        // #13 실패 — 원본 그대로 사용 (마감만 안 된 상태)
        console.warn("[studio-13] failed, using unpolished content:", err);
      }
    }

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
      plan,
      planning,
      team2: finalTeam2,
      quality,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
