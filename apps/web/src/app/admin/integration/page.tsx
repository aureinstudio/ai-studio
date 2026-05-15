import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getIntegrationCallCounts } from "@/lib/meta/orchestrator";

export const dynamic = "force-dynamic";

export default async function IntegrationDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/integration");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // 30일 비용 분포 (service별)
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: costLog } = await admin
    .from("cost_log")
    .select("service, cost_usd")
    .gte("created_at", since30);

  const costByService: Record<string, number> = {};
  for (const row of costLog ?? []) {
    const s = row.service ?? "unknown";
    costByService[s] = (costByService[s] ?? 0) + (Number(row.cost_usd) || 0);
  }

  // 솔루션별 집계
  const studioCost = (costByService.anthropic ?? 0);
  const castCost = (costByService.cast ?? 0) + (costByService.elevenlabs ?? 0) + (costByService.heygen ?? 0);
  const tutorCost = (costByService.tutor ?? 0) + (costByService.gemini ?? 0);
  const totalCost = studioCost + castCost + tutorCost;

  // 호출 카운트
  const { count: studioJobsCount } = await admin
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since30);
  const { count: castJobsCount } = await admin
    .from("cast_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since30);
  const { count: tutorConvCount } = await admin
    .from("tutor_conversations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since30);

  // 통합 호출 (cross-solution)
  const integrationCounts = await getIntegrationCallCounts(admin, 7);

  // 시스템 상태 (대략적 health 추정)
  const { count: recentFailedStudio } = await admin
    .from("studio_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { count: recentFailedCast } = await admin
    .from("cast_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { count: activeAlerts } = await admin
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .is("acknowledged_at", null);

  const { count: highSeverityAlerts } = await admin
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .is("acknowledged_at", null)
    .eq("severity", "high");

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Admin · Integration
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          통합 대시보드
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          3개 솔루션 (Studio · Cast · Tutor) · 29 에이전트 시스템 상태
        </p>
      </div>

      {/* 시스템 헬스 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <HealthCard
          label="Studio"
          subtitle="13 에이전트"
          status={(recentFailedStudio ?? 0) === 0 ? "ok" : "warn"}
          metric={`${studioJobsCount ?? 0} 작업/30일`}
          detail={`24h 실패 ${recentFailedStudio ?? 0}건`}
          link="/studio"
        />
        <HealthCard
          label="Cast"
          subtitle="7 에이전트"
          status={(recentFailedCast ?? 0) === 0 ? "ok" : "warn"}
          metric={`${castJobsCount ?? 0} 작업/30일`}
          detail={`24h 실패 ${recentFailedCast ?? 0}건`}
          link="/cast"
        />
        <HealthCard
          label="Tutor"
          subtitle="9 에이전트"
          status={(highSeverityAlerts ?? 0) === 0 ? "ok" : "warn"}
          metric={`${tutorConvCount ?? 0} 대화/30일`}
          detail={`활성 알림 ${activeAlerts ?? 0} (high ${highSeverityAlerts ?? 0})`}
          link="/admin/students"
        />
        <HealthCard
          label="총 비용 (30일)"
          subtitle="3 솔루션"
          status={totalCost < 100 ? "ok" : totalCost < 200 ? "warn" : "high"}
          metric={`$${totalCost.toFixed(2)}`}
          detail={`평균 $${(totalCost / 30).toFixed(2)}/일`}
        />
      </div>

      {/* 솔루션별 비용 분포 */}
      <Card className="mb-6 border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            솔루션별 비용 분포 (30일)
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <CostBar label="Studio (Anthropic)" value={studioCost} total={totalCost} color="blue" />
          <CostBar label="Cast (Anthropic + ElevenLabs + HeyGen)" value={castCost} total={totalCost} color="violet" />
          <CostBar label="Tutor (Anthropic + Gemini)" value={tutorCost} total={totalCost} color="emerald" />
        </CardContent>
      </Card>

      {/* 솔루션 간 호출 */}
      <Card className="mb-6 border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            솔루션 간 통합 호출 (최근 7일)
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IntegrationCard
              from="Studio"
              to="Cast"
              count={integrationCounts.studio_to_cast}
              description="Studio 작업 → Cast 영상 변환"
            />
            <IntegrationCard
              from="Studio"
              to="Tutor"
              count={integrationCounts.studio_to_tutor}
              description="Studio 작업 → Tutor RAG 인덱싱"
            />
            <IntegrationCard
              from="Tutor"
              to="Cast"
              count={integrationCounts.tutor_to_cast}
              description="Tutor 답변 → Cast Mode B (UI 버튼)"
            />
          </div>
        </CardContent>
      </Card>

      {/* 시연 경로 빠른 이동 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            시연 빠른 이동
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickLink href="/studio" label="Studio" />
            <QuickLink href="/cast" label="Cast Mode A" />
            <QuickLink href="/cast/ask" label="Cast Mode B" />
            <QuickLink href="/tutor" label="Tutor" />
            <QuickLink href="/dashboard/learning" label="학생 진단" />
            <QuickLink href="/admin/students" label="학생 알림" />
            <QuickLink href="/samples" label="공개 샘플" />
            <QuickLink href="/demo" label="CEO Demo" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthCard({
  label,
  subtitle,
  status,
  metric,
  detail,
  link,
}: {
  label: string;
  subtitle: string;
  status: "ok" | "warn" | "high";
  metric: string;
  detail: string;
  link?: string;
}) {
  const colors = {
    ok: "border-emerald-500/30 bg-emerald-500/5",
    warn: "border-amber-500/30 bg-amber-500/5",
    high: "border-red-500/30 bg-red-500/5",
  };
  const dotColors = { ok: "bg-emerald-400", warn: "bg-amber-400", high: "bg-red-400" };
  return (
    <Card className={colors[status]}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${dotColors[status]}`} />
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle}</p>
        <p className="font-mono text-xl font-semibold text-foreground">{metric}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        {link && (
          <Link href={link} className="mt-2 inline-block text-[11px] text-muted-foreground hover:text-foreground">
            바로가기 →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function CostBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "blue" | "violet" | "emerald";
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const bg = {
    blue: "bg-blue-400",
    violet: "bg-violet-400",
    emerald: "bg-emerald-400",
  }[color];
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">
          ${value.toFixed(2)} ({percent.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-border">
        <div
          className={`h-2 rounded-full transition-all ${bg}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function IntegrationCard({
  from,
  to,
  count,
  description,
}: {
  from: string;
  to: string;
  count: number;
  description: string;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground">
        <span>{from}</span>
        <span className="text-muted-foreground">→</span>
        <span>{to}</span>
      </p>
      <p className="font-mono text-2xl font-semibold text-foreground">{count}</p>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-background/40 px-3 py-2 text-center text-xs text-foreground hover:bg-card"
    >
      {label}
    </Link>
  );
}
