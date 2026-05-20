import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  StudioJobResult,
  type AgentLogEntry,
  type CuratorOutput,
  type PlannerOutput,
} from "@/components/StudioJobResult";

export const dynamic = "force-dynamic";

type StudioJobRow = {
  id: string;
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: string;
  status: string;
  user_id: string;
  is_sample: boolean | null;
  agent_logs: AgentLogEntry[] | null;
  content: { curator: CuratorOutput; planner: PlannerOutput } | null;
  cost_usd: number | null;
  duration_seconds: number | null;
};

const LEVEL_LABEL = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
} as const;

export default async function LearnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // UUID 검증 — 잘못된 입력은 즉시 404
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/learn/${id}`);

  // 접근 권한 — (1) 본인 작업, (2) 활성 enrollment 보유, (3) 샘플
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("studio_jobs")
    .select(
      "id, topic, level, length, status, user_id, is_sample, agent_logs, content, cost_usd, duration_seconds",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<StudioJobRow>();

  if (!job) notFound();

  const isOwner = job.user_id === user.id;
  const isSample = job.is_sample === true;

  let isEnrolled = false;
  if (!isOwner && !isSample) {
    const { data: enrollment } = await admin
      .from("student_enrollments")
      .select("id")
      .eq("student_id", user.id)
      .eq("studio_job_id", id)
      .eq("status", "active")
      .maybeSingle();
    isEnrolled = !!enrollment;
  }

  if (!isOwner && !isSample && !isEnrolled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 권한 없음</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이 강의에 등록되지 않았습니다.{" "}
          <Link href="/courses" className="underline">
            카탈로그
          </Link>
          에서 수강 신청해 주세요.
        </p>
      </div>
    );
  }

  if (job.status !== "completed" || !job.content) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">강의 준비 중</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          이 강의는 아직 생성 중입니다 (status: {job.status}). 잠시 후 다시 방문해 주세요.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-card"
        >
          대시보드로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">
          대시보드
        </Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-foreground">
          과정
        </Link>
        <span>/</span>
        <span className="text-muted-foreground/70">학습</span>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Learn
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
            {isSample && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-amber-300">
                샘플
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/tutor?studio_job_id=${id}`}
          className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          🤖 AI Tutor에게 질문 →
        </Link>
      </div>

      {/* 콘텐츠 본문 */}
      <StudioJobResult
        content={job.content}
        agentLogs={job.agent_logs ?? []}
        meta={{
          durationSeconds: job.duration_seconds,
          costUsd: job.cost_usd,
          jobId: job.id,
        }}
      />
    </div>
  );
}
