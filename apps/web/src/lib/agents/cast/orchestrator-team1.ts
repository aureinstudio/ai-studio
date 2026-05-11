import type { SupabaseClient } from "@supabase/supabase-js";
import { SlideAnalyzer, type SlideInputMeta, type SlideAnalyzerOutput } from "./slide-analyzer";
import { ScriptWriter, type ScriptWriterOutput } from "./script-writer";
import { Agent, AgentError, type AgentLog } from "../base";
import { logCost } from "@/lib/cost-tracker";

export type CastTeam1Result = {
  analysis: SlideAnalyzerOutput;
  scripts: ScriptWriterOutput;
  agent_logs: AgentLog[];
  total_cost_usd: number;
  total_duration_ms: number;
};

/**
 * Cast TEAM 1 체인 (v0.14.0).
 *
 * 흐름:
 *   #01 SlideAnalyzer → #02 ScriptWriter
 *
 * TEAM 2 (TTS) · TEAM 3 (Avatar) 는 다음 프롬프트에서 추가.
 */
export async function runCastTeam1(
  supabase: SupabaseClient,
  castJobId: string,
  userId: string,
  topic: string,
  slides: SlideInputMeta[],
  isCertification: boolean,
  model?: string,
): Promise<CastTeam1Result> {
  const overallStart = Date.now();
  const agent_logs: AgentLog[] = [];

  const persistLogs = async () => {
    await supabase.from("cast_jobs").update({ agent_logs }).eq("id", castJobId);
  };

  const runWithProgress = async <I, O>(
    agent: Agent<I, O>,
    input: I,
    chainStep: number,
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

      await logCost({
        supabase,
        service: "cast",
        endpoint: "/api/cast/generate",
        userId,
        tokensIn: result.log.tokens_in,
        tokensOut: result.log.tokens_out,
        costUsd: result.log.cost_usd,
        metadata: { agent_id: agent.id, cast_job_id: castJobId, chain_step: chainStep },
      });
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
    .from("cast_jobs")
    .update({ status: "running", agent_logs: [] })
    .eq("id", castJobId);

  try {
    // #01 — 슬라이드 분석
    const r01 = await runWithProgress(
      new SlideAnalyzer(model),
      { topic, slides, is_certification: isCertification },
      1,
    );

    // #02 — 스크립트 생성
    const r02 = await runWithProgress(
      new ScriptWriter(model),
      { topic, slides, analysis: r01.output, is_certification: isCertification },
      2,
    );

    const totalCost = agent_logs.reduce((s, l) => s + l.cost_usd, 0);
    const totalDurationMs = Date.now() - overallStart;
    const output = { analysis: r01.output, scripts: r02.output };

    await supabase
      .from("cast_jobs")
      .update({
        status: "completed",
        output,
        agent_logs,
        cost_usd: totalCost,
        duration_seconds: totalDurationMs / 1000,
        completed_at: new Date().toISOString(),
      })
      .eq("id", castJobId);

    return {
      analysis: r01.output,
      scripts: r02.output,
      agent_logs,
      total_cost_usd: totalCost,
      total_duration_ms: totalDurationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("cast_jobs")
      .update({
        status: "failed",
        error_message: message,
        agent_logs,
        duration_seconds: (Date.now() - overallStart) / 1000,
      })
      .eq("id", castJobId);
    throw err;
  }
}
