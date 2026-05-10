import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Profile = { id: string; role: "user" | "admin" };

type EvaluationRow = {
  id: string;
  studio_job_id: string;
  rating: number;
  improvements: string | null;
  evaluator_name: string | null;
  evaluator_role: string | null;
  created_at: string;
};

type AgentLog = { agent_id: string; status: string; cost_usd: number };

type JobStat = {
  id: string;
  topic: string;
  status: string;
  cost_usd: number | null;
  duration_seconds: number | null;
  is_sample: boolean | null;
  agent_logs: AgentLog[] | null;
  created_at: string;
};

async function getAdminData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<Profile>();

  if (profile?.role !== "admin") return { unauthorized: true as const };

  // 전체 통계
  const { count: totalJobs } = await supabase
    .from("studio_jobs")
    .select("id", { count: "exact", head: true });

  const { count: completedJobs } = await supabase
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const { count: failedJobs } = await supabase
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { data: recentJobs } = await supabase
    .from("studio_jobs")
    .select("id, topic, status, cost_usd, duration_seconds, is_sample, agent_logs, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<JobStat[]>();

  const { data: evaluations } = await supabase
    .from("sme_evaluations")
    .select("id, studio_job_id, rating, improvements, evaluator_name, evaluator_role, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<EvaluationRow[]>();

  // 에이전트별 호출 빈도
  const agentFreq: Record<string, { count: number; cost: number }> = {};
  for (const job of recentJobs ?? []) {
    for (const log of job.agent_logs ?? []) {
      if (log.status === "completed") {
        agentFreq[log.agent_id] ??= { count: 0, cost: 0 };
        agentFreq[log.agent_id].count++;
        agentFreq[log.agent_id].cost += log.cost_usd ?? 0;
      }
    }
  }

  const evals = evaluations ?? [];
  const avgRating =
    evals.length > 0 ? evals.reduce((s, e) => s + e.rating, 0) / evals.length : null;

  const totalCost = (recentJobs ?? []).reduce((s, j) => s + (j.cost_usd ?? 0), 0);
  const avgDuration =
    (recentJobs ?? []).filter((j) => j.duration_seconds).length > 0
      ? (recentJobs ?? []).reduce((s, j) => s + (j.duration_seconds ?? 0), 0) /
        (recentJobs ?? []).filter((j) => j.duration_seconds).length
      : 0;

  return {
    totalJobs: totalJobs ?? 0,
    completedJobs: completedJobs ?? 0,
    failedJobs: failedJobs ?? 0,
    recentJobs: recentJobs ?? [],
    evaluations: evals,
    avgRating,
    totalCost,
    avgDuration,
    agentFreq,
  };
}

export default async function AdminPage() {
  const data = await getAdminData();
  if (!data) redirect("/login?next=/admin");
  if ("unauthorized" in data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          관리자 권한이 필요합니다.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-foreground underline"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const successRate =
    data.totalJobs > 0 ? (data.completedJobs / data.totalJobs) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Admin
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          시스템 대시보드
        </h1>
      </div>

      {/* 핵심 지표 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="전체 작업" value={data.totalJobs.toString()} />
        <StatCard
          label="성공률"
          value={`${successRate.toFixed(0)}%`}
          sub={`${data.completedJobs}/${data.totalJobs}`}
        />
        <StatCard label="실패" value={data.failedJobs.toString()} />
        <StatCard
          label="평균 시간"
          value={`${data.avgDuration.toFixed(0)}s`}
        />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="최근 20건 비용"
          value={`$${data.totalCost.toFixed(2)}`}
        />
        <StatCard
          label="SME 평균"
          value={data.avgRating !== null ? data.avgRating.toFixed(1) : "—"}
          sub={`${data.evaluations.length}건`}
        />
        <StatCard
          label="평균 비용/건"
          value={`$${(data.totalCost / Math.max(1, data.recentJobs.length)).toFixed(3)}`}
        />
      </div>

      {/* 에이전트 호출 빈도 */}
      <Card className="mb-6 border-border/60 bg-card/80">
        <CardContent className="p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            에이전트 호출 분포 (최근 20건 기준)
          </p>
          <div className="space-y-2">
            {Object.entries(data.agentFreq)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([id, stat]) => {
                const maxCount = Math.max(
                  ...Object.values(data.agentFreq).map((s) => s.count),
                );
                const width = (stat.count / maxCount) * 100;
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="w-24 font-mono text-xs text-muted-foreground">
                      #{id.replace("studio-", "")}
                    </span>
                    <div className="relative h-2 flex-1 rounded-full bg-border">
                      <div
                        className="absolute left-0 top-0 h-2 rounded-full bg-foreground/60"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-xs text-foreground">
                      {stat.count}
                    </span>
                    <span className="w-20 text-right font-mono text-xs text-muted-foreground">
                      ${stat.cost.toFixed(3)}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* SME 평가 목록 */}
      <Card className="mb-6 border-border/60 bg-card/80">
        <CardContent className="p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            최근 SME 평가
          </p>
          {data.evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 SME 평가가 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {data.evaluations.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">{e.rating}/5</span>
                    <span className="text-muted-foreground">
                      {e.evaluator_name ?? "익명"}
                      {e.evaluator_role && ` · ${e.evaluator_role}`}
                    </span>
                    {e.improvements && (
                      <span className="line-clamp-1 text-foreground/80">
                        {e.improvements}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/samples/${e.studio_job_id}`}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    {e.studio_job_id.slice(0, 8)}…
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-2xl font-semibold text-foreground">
          {value}
        </p>
        {sub && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
