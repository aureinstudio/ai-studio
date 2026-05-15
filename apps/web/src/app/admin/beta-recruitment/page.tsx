import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BetaRecruitmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/beta-recruitment");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();

  // 신청 + 상태별
  const { data: allApps } = await admin
    .from("beta_applications")
    .select("status, created_at, source, reviewed_at, invite_sent_at, first_login_at, invited_user_id");
  const apps = allApps ?? [];

  const counts = {
    total: apps.length,
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
    onboarded: apps.filter((a) => a.status === "onboarded").length,
  };

  // Funnel: 신청 → 승인 → 가입(invited_user_id) → 온보딩 완료 → 7일 활성
  const approved = apps.filter((a) => a.status === "approved" || a.status === "onboarded").length;
  const signedUp = apps.filter((a) => a.invited_user_id).length;
  const onboarded = apps.filter((a) => a.status === "onboarded").length;

  // 7일 활성 — onboarded 중 last_seen_at >= 7일내
  const onboardedUserIds = apps
    .filter((a) => a.status === "onboarded" && a.invited_user_id)
    .map((a) => a.invited_user_id);
  let active7d = 0;
  if (onboardedUserIds.length > 0) {
    const { data: actives } = await admin
      .from("profiles")
      .select("id")
      .in("id", onboardedUserIds as string[])
      .gte("last_seen_at", since7d);
    active7d = actives?.length ?? 0;
  }

  // 일별 신청 추이 (30일)
  const byDay: Record<string, number> = {};
  for (const a of apps) {
    if (a.created_at >= since30d) {
      const d = a.created_at.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
  }
  const days = Object.keys(byDay).sort();
  const maxDay = Math.max(...Object.values(byDay), 1);

  // 캠페인 source 효과
  const bySource: Record<string, { total: number; onboarded: number }> = {};
  for (const a of apps) {
    const k = a.source ?? "(direct)";
    if (!bySource[k]) bySource[k] = { total: 0, onboarded: 0 };
    bySource[k].total++;
    if (a.status === "onboarded") bySource[k].onboarded++;
  }

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">베타 모집 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">30일 신청 추이 + Funnel + 캠페인 효과</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
      </header>

      {/* 카운트 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "총 신청", value: counts.total },
          { label: "대기", value: counts.pending },
          { label: "승인", value: counts.approved },
          { label: "거부", value: counts.rejected },
          { label: "온보딩 완료", value: counts.onboarded },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 text-center">
              <div className="text-xs uppercase text-muted-foreground">{c.label}</div>
              <div className="mt-2 text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">전환 Funnel</h2></CardHeader>
        <CardContent className="px-6 pb-6 space-y-2">
          {[
            { label: "신청", n: counts.total, base: counts.total },
            { label: "승인", n: approved, base: counts.total },
            { label: "가입", n: signedUp, base: approved },
            { label: "온보딩 완료", n: onboarded, base: signedUp },
            { label: "7일 활성", n: active7d, base: onboarded },
          ].map((step, i, arr) => {
            const widthPct = counts.total > 0 ? (step.n / counts.total) * 100 : 0;
            const stepPct = i === 0 ? 100 : pct(step.n, arr[i - 1].n);
            return (
              <div key={step.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{step.label}</span>
                  <span className="font-mono">
                    {step.n} <span className="text-muted-foreground">({stepPct}%)</span>
                  </span>
                </div>
                <div className="h-7 bg-muted rounded">
                  <div
                    className="h-full bg-blue-500 rounded flex items-center px-2 text-xs text-white"
                    style={{ width: `${Math.max(2, widthPct)}%` }}
                  >
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 일별 추이 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">일별 신청 추이 (30일)</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터 없음.</p>
          ) : (
            <div className="flex gap-1 h-32 items-end">
              {days.map((d) => {
                const v = byDay[d];
                return (
                  <div key={d} className="flex-1 flex flex-col items-center group">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{ height: `${(v / maxDay) * 100}%`, minHeight: "2px" }}
                      title={`${d}: ${v}건`}
                    />
                    <div className="text-[9px] text-muted-foreground mt-1 rotate-45 origin-left whitespace-nowrap">{d.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 캠페인 효과 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">캠페인별 효과 (UTM source)</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          {Object.keys(bySource).length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터 없음.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">출처</th>
                  <th className="text-right">신청</th>
                  <th className="text-right">온보딩</th>
                  <th className="text-right">전환율</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(bySource)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([s, v]) => (
                    <tr key={s} className="border-b">
                      <td className="py-2 font-mono">{s}</td>
                      <td className="text-right font-mono">{v.total}</td>
                      <td className="text-right font-mono">{v.onboarded}</td>
                      <td className="text-right font-mono">{pct(v.onboarded, v.total)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
