"use client";

import type { AgentLogEntry } from "./StudioJobResult";

type AgentMeta = { id: string; name: string };

type TeamConfig = {
  id: string;
  label: string;
  colorClass: string;
  badgeClass: string;
  agents: AgentMeta[];
};

const TEAMS: TeamConfig[] = [
  {
    id: "T3",
    label: "TEAM 3 · 오케스트레이션",
    colorClass: "border-emerald-500/30 bg-emerald-500/5",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
    agents: [{ id: "studio-09", name: "오케스트레이터" }],
  },
  {
    id: "T1",
    label: "TEAM 1 · 기획",
    colorClass: "border-blue-500/30 bg-blue-500/5",
    badgeClass: "bg-blue-500/10 text-blue-400",
    agents: [
      { id: "studio-01", name: "종합 분석" },
      { id: "studio-02", name: "환경 조사" },
      { id: "studio-03", name: "주제 조사" },
      { id: "studio-04", name: "개요 작성" },
    ],
  },
  {
    id: "T2",
    label: "TEAM 2 · 제작",
    colorClass: "border-violet-500/30 bg-violet-500/5",
    badgeClass: "bg-violet-500/10 text-violet-400",
    agents: [
      { id: "studio-05", name: "학습프로세스" },
      { id: "studio-06", name: "본문 큐레이터" },
      { id: "studio-07", name: "시각 기획" },
      { id: "studio-08", name: "인포그래픽" },
    ],
  },
  {
    id: "T4",
    label: "TEAM 4 · 품질",
    colorClass: "border-amber-500/30 bg-amber-500/5",
    badgeClass: "bg-amber-500/10 text-amber-400",
    agents: [
      { id: "studio-10", name: "검토" },
      { id: "studio-11", name: "형식 확인" },
      { id: "studio-12", name: "종합 검토" },
      { id: "studio-13", name: "최종 마감" },
    ],
  },
];

type AgentCollaborationViewProps = {
  agentLogs: AgentLogEntry[];
  skippedAgents?: string[];
  jobStatus: "pending" | "running" | "completed" | "failed";
};

export function AgentCollaborationView({
  agentLogs,
  skippedAgents = [],
  jobStatus,
}: AgentCollaborationViewProps) {
  const logMap = new Map(agentLogs.map((l) => [l.agent_id, l]));
  const skippedSet = new Set(skippedAgents);

  const getStatus = (agentId: string): string => {
    if (skippedSet.has(agentId)) return "skipped";
    const log = logMap.get(agentId);
    if (!log) return jobStatus === "running" ? "waiting" : "idle";
    // "started" → "running"으로 매핑 (UI 펄스)
    if (log.status === "started") return "running";
    return log.status;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {TEAMS.map((team) => (
        <div
          key={team.id}
          className={`rounded-lg border p-3 ${team.colorClass}`}
        >
          <p className={`mb-2.5 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${team.badgeClass} inline-block`}>
            {team.label}
          </p>
          <div className="space-y-1.5">
            {team.agents.map((agent) => {
              const status = getStatus(agent.id);
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-2"
                >
                  <StatusDot status={status} />
                  <span
                    className={`font-mono text-[10px] text-muted-foreground/60`}
                  >
                    #{agent.id.replace("studio-", "")}
                  </span>
                  <span
                    className={`text-xs ${
                      status === "completed"
                        ? "text-foreground"
                        : status === "skipped"
                          ? "text-muted-foreground/40 line-through"
                          : status === "failed"
                            ? "text-red-300"
                            : status === "running" || (status === "waiting" && isNextToRun(agent.id, agentLogs, skippedSet))
                              ? "text-foreground"
                              : "text-muted-foreground/60"
                    }`}
                  >
                    {agent.name}
                  </span>
                  {status === "skipped" && (
                    <span className="rounded-full bg-muted-foreground/10 px-1.5 py-0.5 text-[9px] text-muted-foreground/50">
                      스킵
                    </span>
                  )}
                  {status === "completed" && logMap.get(agent.id)?.cost_usd ? (
                    <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">
                      ${logMap.get(agent.id)!.cost_usd.toFixed(3)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "completed")
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400" />;
  if (status === "failed")
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-400" />;
  if (status === "skipped")
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-border opacity-40" />;
  if (status === "running")
    return <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-foreground" />;
  // waiting / idle
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full border border-border" />;
}

function isNextToRun(agentId: string, logs: AgentLogEntry[], skipped: Set<string>): boolean {
  const allIds = TEAMS.flatMap((t) => t.agents.map((a) => a.id));
  const idx = allIds.indexOf(agentId);
  if (idx === 0) return true;
  const prev = allIds[idx - 1];
  const prevLog = logs.find((l) => l.agent_id === prev);
  return (prevLog?.status === "completed" || skipped.has(prev)) && !logs.find((l) => l.agent_id === agentId);
}
