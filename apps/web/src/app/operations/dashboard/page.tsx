import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { COST_LIMITS } from "@/lib/cost-guard";

export const dynamic = "force-dynamic";

export default async function OperationsDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/operations/dashboard");
  const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "operations" && profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const sinceToday = (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d.toISOString(); })();
  const sinceMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return d.toISOString(); })();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [
    { count: openTickets },
    { count: pendingApplications },
    { count: openIncidents },
    { data: todayCosts },
    { data: monthCosts },
    { count: activeStudents7d },
    { data: alertsOpen },
  ] = await Promise.all([
    admin.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
    admin.from("beta_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("incidents").select("*", { count: "exact", head: true }).is("resolved_at", null),
    admin.from("cost_log").select("cost_usd").gte("created_at", sinceToday),
    admin.from("cost_log").select("cost_usd").gte("created_at", sinceMonth),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user").gte("last_seen_at", since7d),
    admin.from("admin_alerts").select("severity").is("acknowledged_at", null),
  ]);

  const sum = (rs: { cost_usd: number | null }[] | null) =>
    (rs ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const todayUsd = sum(todayCosts);
  const monthUsd = sum(monthCosts);
  const monthBudget = COST_LIMITS.global_monthly;
  const budgetPct = (monthUsd / monthBudget) * 100;

  const highAlerts = (alertsOpen ?? []).filter((a) => a.severity === "high").length;
  const mediumAlerts = (alertsOpen ?? []).filter((a) => a.severity === "medium").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">운영팀 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.name ?? "운영팀"}님 · 일상 운영 한눈에
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/runbook?doc=daily-ops" className="px-3 py-1.5 text-sm rounded bg-foreground text-background">
            🌅 일상 운영 매뉴얼
          </Link>
        </div>
      </header>

      {/* 1차 액션 큐 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActionCard
          label="대기 베타 신청"
          value={pendingApplications ?? 0}
          href="/admin/beta-applications"
          urgent={(pendingApplications ?? 0) > 5}
        />
        <ActionCard
          label="미응답 CS"
          value={openTickets ?? 0}
          href="/support"
          urgent={(openTickets ?? 0) > 0}
        />
        <ActionCard
          label="미확인 위험 알림"
          value={highAlerts + mediumAlerts}
          href="/admin/at-risk-students"
          urgent={highAlerts > 0}
          sub={highAlerts > 0 ? `high ${highAlerts}` : undefined}
        />
        <ActionCard
          label="진행 중 인시던트"
          value={openIncidents ?? 0}
          href="/admin/monitoring"
          urgent={(openIncidents ?? 0) > 0}
        />
      </div>

      {/* 비용 진행 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">비용 현황</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-xs uppercase text-muted-foreground">오늘</div>
              <div className="text-2xl font-bold mt-1">${todayUsd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">한도 ${COST_LIMITS.global_daily}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">이번 달</div>
              <div className="text-2xl font-bold mt-1">${monthUsd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">한도 ${monthBudget}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">월 예산 진행률</div>
              <div className={`text-2xl font-bold mt-1 ${
                budgetPct >= 80 ? "text-red-600" : budgetPct >= 60 ? "text-amber-600" : "text-emerald-600"
              }`}>{budgetPct.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-4 h-2 bg-muted rounded">
            <div
              className={`h-full rounded ${
                budgetPct >= 80 ? "bg-red-500" : budgetPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 학생 활성도 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">학생 활성도</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-xs uppercase text-muted-foreground">7일 활성</div>
              <div className="text-3xl font-bold mt-1">{activeStudents7d ?? 0}명</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">상세 분석</div>
              <Link href="/admin/executive" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                경영 대시보드 →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 빠른 링크 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">자주 쓰는 페이지</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6 grid grid-cols-2 md:grid-cols-3 gap-2">
          <QuickLink href="/admin/monitoring" label="실시간 모니터링" />
          <QuickLink href="/admin/at-risk-students" label="위험 학생" />
          <QuickLink href="/admin/security" label="보안 감사" />
          <QuickLink href="/admin/beta-recruitment" label="모집 분석" />
          <QuickLink href="/admin/courses-overview" label="과정 통합" />
          <QuickLink href="/admin/data-export" label="데이터 내보내기" />
        </CardContent>
      </Card>
    </div>
  );
}

function ActionCard({
  label,
  value,
  href,
  urgent,
  sub,
}: {
  label: string;
  value: number;
  href: string;
  urgent?: boolean;
  sub?: string;
}) {
  return (
    <Link href={href}>
      <Card className={urgent ? "border-red-300 bg-red-50/20 dark:bg-red-950/20" : "hover:bg-muted/40 transition-colors"}>
        <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-bold ${urgent ? "text-red-600" : ""}`}>{value}</div>
          {sub && <div className="text-[10px] text-red-600 mt-0.5">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded border px-3 py-2 text-sm hover:bg-muted transition-colors">
      {label} →
    </Link>
  );
}
