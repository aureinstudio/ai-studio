import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * CEO/COO 뷰 — 비기술 정보만. 베타 운영 추이.
 */
export default async function ExecutivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/executive");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
      </div>
    );
  }

  const admin = createAdminClient();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const sinceMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return d.toISOString(); })();

  // 학생 (전체 활성 = 7일 내 1회 이상 로그인 = profiles.updated_at 사용)
  const { count: totalStudents } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "user");
  const { count: activeStudents } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "user")
    .gte("updated_at", since7d);

  // 콘텐츠
  const { count: studio7d } = await admin
    .from("studio_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", since7d);
  const { count: cast7d } = await admin
    .from("cast_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", since7d);

  // 30일 비용 추세
  const { data: costs30 } = await admin
    .from("cost_log")
    .select("cost_usd, created_at")
    .gte("created_at", since30d);
  const cost30d = (costs30 ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);

  // 이번 달 예산 진행 (기본 한도 $1000)
  const monthBudget = Number(process.env.COST_GLOBAL_MONTHLY_USD ?? 1000);
  const { data: costsMonth } = await admin
    .from("cost_log")
    .select("cost_usd")
    .gte("created_at", sinceMonth);
  const monthSpent = (costsMonth ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const budgetPct = (monthSpent / monthBudget) * 100;

  // 안전 — 위험 신호 학생 (7일)
  const { count: alerts7d } = await admin
    .from("admin_alerts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since7d);

  // 만족도 — sme_evals 평균 (전체)
  const { data: evals } = await admin
    .from("sme_evaluations")
    .select("rating");
  const ratingAvg = (evals ?? []).length > 0
    ? (evals ?? []).reduce((s, r) => s + Number(r.rating ?? 0), 0) / (evals ?? []).length
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">경영 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">베타 운영 핵심 지표 (최근 7~30일)</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
      </header>

      {/* 학생 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">학생</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase text-muted-foreground">전체</div>
              <div className="text-3xl font-bold mt-1">{totalStudents ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">활성 (7일)</div>
              <div className="text-3xl font-bold mt-1">{activeStudents ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                활성률 {totalStudents ? Math.round(((activeStudents ?? 0) / totalStudents) * 100) : 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 콘텐츠 생산량 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">콘텐츠 생산량 (7일)</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Studio 콘텐츠</div>
              <div className="text-3xl font-bold mt-1">{studio7d ?? 0}건</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Cast 영상</div>
              <div className="text-3xl font-bold mt-1">{cast7d ?? 0}건</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 예산 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">월간 예산 진행률</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex justify-between text-sm">
            <span>사용 ${monthSpent.toFixed(2)} / 한도 ${monthBudget.toFixed(0)}</span>
            <span className={budgetPct >= 80 ? "text-red-600 font-bold" : budgetPct >= 60 ? "text-amber-600" : "text-emerald-600"}>
              {budgetPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 h-3 bg-muted rounded overflow-hidden">
            <div
              className={`h-full ${budgetPct >= 80 ? "bg-red-500" : budgetPct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">30일 누적 비용: ${cost30d.toFixed(2)}</p>
        </CardContent>
      </Card>

      {/* 학생 안전 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">학생 안전</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase text-muted-foreground">위험 신호 (7일)</div>
              <div className={`text-3xl font-bold mt-1 ${(alerts7d ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {alerts7d ?? 0}건
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">SME 평균 평가</div>
              <div className="text-3xl font-bold mt-1">{ratingAvg.toFixed(1)} / 5</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
