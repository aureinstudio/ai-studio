import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioJobResult } from "@/components/StudioJobResult";
import { SmeEvaluationForm } from "./SmeEvaluationForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SampleJob = {
  id: string;
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: string;
  sample_label: string | null;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent_logs: any;
  cost_usd: number | null;
  duration_seconds: number | null;
  is_sample: boolean;
};

type Evaluation = {
  id: string;
  rating: number;
  improvements: string | null;
  evaluator_name: string | null;
  evaluator_role: string | null;
  created_at: string;
};

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("studio_jobs")
    .select("*")
    .eq("id", id)
    .eq("is_sample", true)
    .single<SampleJob>();

  if (!job || !job.content) notFound();

  const { data: evaluations } = await supabase
    .from("sme_evaluations")
    .select("id, rating, improvements, evaluator_name, evaluator_role, created_at")
    .eq("studio_job_id", id)
    .order("created_at", { ascending: false })
    .returns<Evaluation[]>();

  const evals = evaluations ?? [];
  const avgRating =
    evals.length > 0
      ? evals.reduce((sum, e) => sum + e.rating, 0) / evals.length
      : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      <Link
        href="/samples"
        className="mb-6 inline-block text-xs text-muted-foreground hover:text-foreground"
      >
        ← 샘플 목록으로
      </Link>

      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {job.sample_label ?? "샘플"} · {job.level}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {job.topic}
        </h1>
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

      {/* SME 평가 섹션 */}
      <div className="mt-12 border-t border-border/40 pt-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            SME 평가
          </h2>
          {avgRating !== null && (
            <p className="font-mono text-sm text-muted-foreground">
              평균{" "}
              <span className="text-lg font-semibold text-foreground">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-xs"> / 5.0 ({evals.length}건)</span>
            </p>
          )}
        </div>

        {/* 평가 폼 */}
        <Card className="mb-6 border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              평가 제출
            </p>
          </CardHeader>
          <CardContent>
            <SmeEvaluationForm jobId={job.id} />
          </CardContent>
        </Card>

        {/* 기존 평가 목록 */}
        {evals.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              제출된 평가 ({evals.length}건)
            </p>
            {evals.map((e) => (
              <Card key={e.id} className="border-border/60 bg-card/40">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{"⭐".repeat(e.rating)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {e.rating}/5
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.evaluator_name ?? "익명"}
                      {e.evaluator_role && ` · ${e.evaluator_role}`}
                      {" · "}
                      {new Date(e.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  {e.improvements && (
                    <p className="text-sm text-foreground/80">{e.improvements}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
