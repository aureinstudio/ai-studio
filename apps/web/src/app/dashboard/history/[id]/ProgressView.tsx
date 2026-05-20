"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AgentLog = {
  agent_id: string;
  agent_name: string;
  status: "started" | "completed" | "failed" | "skipped";
  duration_ms?: number;
  cost_usd?: number;
  error?: string;
};

type JobPoll = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  agent_logs: AgentLog[] | null;
  error: string | null;
};

const POLL_INTERVAL_MS = 3000;
const STATUS_LABEL: Record<JobPoll["status"], string> = {
  pending: "대기 중",
  running: "진행 중",
  completed: "완료",
  failed: "실패",
};

export function ProgressView({
  jobId,
  initialStatus,
  initialLogs,
}: {
  jobId: string;
  initialStatus: JobPoll["status"];
  initialLogs: AgentLog[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobPoll["status"]>(initialStatus);
  const [logs, setLogs] = useState<AgentLog[]>(initialLogs);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/studio/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as JobPoll;
        if (cancelled) return;
        setLogs(data.agent_logs ?? []);
        setStatus(data.status);
        setError(data.error);
        if (data.status === "completed" || data.status === "failed") {
          // 결과 본문은 server component가 렌더하므로 페이지 새로고침
          router.refresh();
          return;
        }
      } catch {
        // 일시적 네트워크 에러는 무시 — 다음 폴링에서 재시도
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, status, router]);

  const lastCompleted = [...logs].reverse().find((l) => l.status === "completed");
  const currentRunning = logs.find((l) => l.status === "started");

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-sm font-medium text-foreground">
            {STATUS_LABEL[status]} · 에이전트 {logs.length}개 실행됨
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {POLL_INTERVAL_MS / 1000}초마다 자동 갱신
        </span>
      </div>

      {currentRunning && (
        <div className="mb-4 rounded border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs">
          <span className="font-mono text-blue-300">[{currentRunning.agent_id}]</span>{" "}
          <span className="text-foreground">{currentRunning.agent_name}</span>{" "}
          <span className="text-muted-foreground">실행 중...</span>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          아직 시작된 에이전트가 없습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {logs.map((log, i) => (
            <li
              key={`${log.agent_id}-${i}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1 truncate">
                <span
                  className={`mr-2 inline-block w-4 text-center ${
                    log.status === "completed"
                      ? "text-emerald-400"
                      : log.status === "failed"
                        ? "text-red-400"
                        : log.status === "started"
                          ? "text-blue-400"
                          : "text-muted-foreground"
                  }`}
                >
                  {log.status === "completed"
                    ? "✓"
                    : log.status === "failed"
                      ? "✗"
                      : log.status === "skipped"
                        ? "○"
                        : "▶"}
                </span>
                <span className="font-mono text-muted-foreground">[{log.agent_id}]</span>{" "}
                <span className="text-foreground">{log.agent_name}</span>
                {log.error && (
                  <span className="ml-2 text-red-300">— {log.error.slice(0, 80)}</span>
                )}
              </div>
              {log.duration_ms != null && log.status === "completed" && (
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {(log.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="mt-4 text-xs text-red-300">에러: {error}</p>
      )}

      {lastCompleted && status === "running" && (
        <p className="mt-4 text-[10px] text-muted-foreground">
          마지막 완료: {lastCompleted.agent_name}
        </p>
      )}
    </div>
  );
}
