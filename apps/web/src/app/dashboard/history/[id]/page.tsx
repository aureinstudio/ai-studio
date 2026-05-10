import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  StudioJobResult,
  type AgentLogEntry,
  type CuratorOutput,
  type PlannerOutput,
} from "@/components/StudioJobResult";
import { HistoryDetailActions } from "./HistoryDetailActions";

export const dynamic = "force-dynamic";

type StudioJobRow = {
  id: string;
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: "short" | "medium" | "long";
  status: "pending" | "running" | "completed" | "failed";
  agent_logs: AgentLogEntry[];
  content: { curator: CuratorOutput; planner: PlannerOutput } | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  error: string | null;
  created_at: string;
};

const LEVEL_LABEL = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
} as const;

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/history");

  const { data: job } = await supabase
    .from("studio_jobs")
    .select(
      "id, topic, level, length, status, agent_logs, content, cost_usd, duration_seconds, error, created_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single<StudioJobRow>();

  if (!job) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard/history" className="hover:text-foreground">
          내 작업
        </Link>
        <span>/</span>
        <span className="font-mono text-muted-foreground/70">
          {job.id.slice(0, 8)}…
        </span>
      </div>

      {/* Brief 카드 */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Brief
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {job.topic}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            수준: <span className="text-foreground">{LEVEL_LABEL[job.level]}</span>
          </span>
          <span>
            길이: <span className="text-foreground">{job.length}</span>
          </span>
          <span>
            생성:{" "}
            <span className="text-foreground">
              {new Date(job.created_at).toLocaleString("ko-KR")}
            </span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
              job.status === "completed"
                ? "bg-emerald-500/10 text-emerald-300"
                : job.status === "failed"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-foreground/10 text-foreground"
            }`}
          >
            {job.status}
          </span>
        </div>
      </div>

      {/* Actions (Client component — share/regenerate/delete) */}
      <HistoryDetailActions jobId={job.id} topic={job.topic} level={job.level} />

      {/* 결과 (또는 실패 메시지) */}
      <div className="mt-10">
        {job.status === "completed" && job.content ? (
          <StudioJobResult
            content={job.content}
            agentLogs={job.agent_logs}
            meta={{
              durationSeconds: job.duration_seconds,
              costUsd: job.cost_usd,
              jobId: job.id,
            }}
          />
        ) : job.status === "failed" ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <p className="mb-1 font-medium">작업 실패</p>
            <p className="text-xs">{job.error ?? "알 수 없는 오류"}</p>
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
            아직 진행 중인 작업입니다 (status: {job.status}).{" "}
            <Link
              href="/studio"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              실시간 진행 상황 보기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
