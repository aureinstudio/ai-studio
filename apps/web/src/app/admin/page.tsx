import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Profile = { id: string; role: "user" | "admin" | "keg_super_admin" | "sme" | "instructor" | "operations" | "creator" | "customer" | "tenant_admin" };

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

  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return { unauthorized: true as const };

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

  // Cast 통계 (Mode A vs Mode B) + 품질 점수
  const { data: castStats } = await supabase
    .from("cast_jobs")
    .select("mode, status, cost_usd, quality_score, retry_count")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const castA = (castStats ?? []).filter((c) => c.mode === "batch");
  const castB = (castStats ?? []).filter((c) => c.mode === "realtime");

  // 품질 점수 집계 (Mode A 만 — quality_score 존재)
  type QualityScore = {
    naturalness_score?: number;
    pacing_score?: number;
    clarity_score?: number;
    overall_pass?: boolean;
  };
  const withQuality = (castStats ?? []).filter(
    (c): c is typeof c & { quality_score: QualityScore } => !!c.quality_score,
  );
  const qualityAvg = withQuality.length
    ? {
        naturalness: withQuality.reduce(
          (s, c) => s + (c.quality_score.naturalness_score ?? 0),
          0,
        ) / withQuality.length,
        pacing: withQuality.reduce(
          (s, c) => s + (c.quality_score.pacing_score ?? 0),
          0,
        ) / withQuality.length,
        clarity: withQuality.reduce(
          (s, c) => s + (c.quality_score.clarity_score ?? 0),
          0,
        ) / withQuality.length,
        pass_rate:
          withQuality.filter((c) => c.quality_score.overall_pass).length /
          withQuality.length,
      }
    : null;
  const totalRetries = (castStats ?? []).reduce(
    (s, c) => s + (Number(c.retry_count) || 0),
    0,
  );

  const castStat = {
    a_count: castA.length,
    a_cost: castA.reduce((s, c) => s + (Number(c.cost_usd) || 0), 0),
    a_completed: castA.filter((c) => c.status === "completed").length,
    b_count: castB.length,
    b_cost: castB.reduce((s, c) => s + (Number(c.cost_usd) || 0), 0),
    b_completed: castB.filter((c) => c.status === "completed").length,
    quality: qualityAvg,
    quality_samples: withQuality.length,
    total_retries: totalRetries,
  };

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
    castStat,
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

      {/* 빠른 이동 — 모든 관리자 페이지 */}
      <div className="mb-10 space-y-6">
        <AdminNavSection
          title="운영 모니터링"
          items={[
            { href: "/admin/monitoring", label: "실시간 모니터링", desc: "동시접속·API/min·헬스" },
            { href: "/admin/security", label: "보안 감사", desc: "차단·rate limit·audit_log" },
            { href: "/admin/integration", label: "통합 분석", desc: "비용·agent 분포" },
            { href: "/admin/executive", label: "경영 대시보드", desc: "CEO 뷰 (비기술)" },
            { href: "/admin/courses-overview", label: "과정 카테고리 통합", desc: "5 카테고리별 성과·비용 (Phase 3)" },
            { href: "/admin/users", label: "사용자 역할 관리", desc: "admin·운영팀·강사·SME 권한 부여" },
            { href: "/admin/founder-dependency", label: "본부장 의존도", desc: "위임 비율 추적 (W12)" },
            { href: "/admin/department-insights", label: "부서별 인사이트", desc: "KEG 6 본부 활용 매핑" },
            { href: "/admin/training-program", label: "전사 교육 프로그램", desc: "5 직책별 모듈" },
          ]}
        />
        <AdminNavSection
          title="학생 케어"
          items={[
            { href: "/admin/students", label: "학생 알림", desc: "위험 신호 알림 이력" },
            { href: "/admin/at-risk-students", label: "위험 학생 모니터", desc: "우선순위·개입 액션" },
            { href: "/admin/remediation", label: "콘텐츠 보완 큐", desc: "SME 합격선 미달 추적" },
          ]}
        />
        <AdminNavSection
          title="베타 운영"
          items={[
            { href: "/admin/beta-applications", label: "베타 신청 검토", desc: "승인·거부" },
            { href: "/admin/beta-recruitment", label: "모집 대시보드", desc: "Funnel + 캠페인 효과" },
          ]}
        />
        <AdminNavSection
          title="Gate G2 (W7-W8)"
          items={[
            { href: "/admin/hypothesis-tracking", label: "가설 추적", desc: "5개 KPI 실시간" },
            { href: "/admin/g2-readiness", label: "G2 종합", desc: "4 조건 진척률" },
            { href: "/admin/g2-final-report", label: "Final Report", desc: "인쇄·PDF 저장" },
            { href: "/admin/g2-decision", label: "G2 의사결정", desc: "GO/HOLD/NO-GO 기록" },
            { href: "/admin/retrospective", label: "4주 회고", desc: "TF 자유 입력" },
            { href: "/admin/phase3-prep", label: "Phase 3 준비", desc: "확장 체크리스트" },
          ]}
        />
        <AdminNavSection
          title="자료"
          items={[
            { href: "/admin/runbook", label: "운영 매뉴얼", desc: "7개 셀프 서비스 문서 (W10)" },
            { href: "/admin/instructor-incentives", label: "강사 인센티브", desc: "월간 자동 계산 + 확정 (W13)" },
            { href: "/admin/proposals", label: "콘텐츠 제안 검토", desc: "강사 제안 SME 검토 큐 (W13)" },
            { href: "/admin/course-expansion", label: "과정 확장 트래킹", desc: "5 → 10 과정 마이그레이션 (W21)" },
            { href: "/admin/referrals", label: "추천 코드 관리", desc: "학생 모집 가속 (W21)" },
            { href: "/admin/g3-final-report", label: "G3 종합 보고서", desc: "14주 KPI·가설·ROI·자유서술 (W14)" },
            { href: "/admin/g3-decision", label: "G3 의사결정", desc: "EXPAND/DEEPEN/SAAS/STOP 4-옵션 (W14)" },
            { href: "/admin/saas-feasibility", label: "SaaS 사업성", desc: "B2B 시장·가격·경쟁 분석 (W14)" },
            { href: "/admin/revenue-projection", label: "매출 시뮬레이션", desc: "3-시나리오 24개월 예측 (W14)" },
            { href: "/admin/retrospective-final", label: "14주 종합 회고", desc: "TF 전원 영구 자산화 (W14)" },
            { href: "/admin/anonymize-data", label: "학생 데이터 처리", desc: "베타 종료 익명화/삭제 일괄 (W14)" },
            { href: "/admin/api-keys", label: "API 키 관리", desc: "B2B 고객사 키 발급·취소 (v0.40)" },
            { href: "/admin/data-export", label: "데이터 내보내기", desc: "CSV·JSON (PII 해싱)" },
            { href: "/docs/api", label: "API 공개 문서", desc: "외부 통합 가이드" },
            { href: "/api/admin/g2-final-report", label: "Final Report JSON", desc: "API 직접 호출" },
            { href: "/api/health", label: "헬스 체크 JSON", desc: "UptimeRobot 등록용" },
          ]}
        />
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

      {/* Cast 통계 (30일) */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Cast Mode A (batch, 30일)"
          value={data.castStat.a_count.toString()}
          sub={`완료 ${data.castStat.a_completed} · $${data.castStat.a_cost.toFixed(2)}`}
        />
        <StatCard
          label="Cast Mode B (realtime, 30일)"
          value={data.castStat.b_count.toString()}
          sub={`완료 ${data.castStat.b_completed} · $${data.castStat.b_cost.toFixed(2)}`}
        />
        <StatCard
          label="Cast 총 비용 (30일)"
          value={`$${(data.castStat.a_cost + data.castStat.b_cost).toFixed(2)}`}
        />
        <StatCard
          label="Cast 평균/건"
          value={`$${
            ((data.castStat.a_cost + data.castStat.b_cost) /
              Math.max(1, data.castStat.a_count + data.castStat.b_count))
              .toFixed(3)
          }`}
        />
      </div>

      {/* Cast 품질 점수 (#07 QualityChecker) */}
      {data.castStat.quality && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard
            label="자연성 (#07)"
            value={data.castStat.quality.naturalness.toFixed(0)}
            sub={`${data.castStat.quality_samples}건 기준`}
          />
          <StatCard
            label="페이싱"
            value={data.castStat.quality.pacing.toFixed(0)}
          />
          <StatCard
            label="명료성"
            value={data.castStat.quality.clarity.toFixed(0)}
          />
          <StatCard
            label="품질 통과율"
            value={`${(data.castStat.quality.pass_rate * 100).toFixed(0)}%`}
          />
          <StatCard
            label="자동 재생성"
            value={data.castStat.total_retries.toString()}
            sub="누적 retry"
          />
        </div>
      )}

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

function AdminNavSection({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; desc: string }[];
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="group block rounded-md border border-border/60 bg-card/40 p-3 transition-colors hover:border-foreground/40 hover:bg-card"
          >
            <div className="text-sm font-medium text-foreground group-hover:underline">
              {it.label} →
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{it.desc}</div>
          </Link>
        ))}
      </div>
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
