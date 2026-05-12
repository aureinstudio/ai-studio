import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Check = { name: string; status: "ok" | "fail" | "skip"; latency_ms: number; detail?: string };

export default async function MonitoringPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/monitoring");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const now = Date.now();
  const since1m = new Date(now - 60_000).toISOString();
  const since1h = new Date(now - 3600_000).toISOString();
  const since24h = new Date(now - 86400_000).toISOString();
  const sinceToday = (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d.toISOString(); })();
  const sinceMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return d.toISOString(); })();
  const sinceWeek = new Date(now - 7*86400_000).toISOString();

  // 1) 분당·시간당 cost_log row수 = API 호출 빈도 근사
  const [{ count: callsLastMin }, { count: callsLastHour }] = await Promise.all([
    admin.from("cost_log").select("*", { count: "exact", head: true }).gte("created_at", since1m),
    admin.from("cost_log").select("*", { count: "exact", head: true }).gte("created_at", since1h),
  ]);

  // 2) 동시 접속자 근사 — 최근 1분 활성 tutor_conversations
  const { count: activeConvs } = await admin
    .from("tutor_conversations")
    .select("*", { count: "exact", head: true })
    .gte("last_active_at", since1m);

  // 3) 비용
  const [{ data: costsToday }, { data: costsWeek }, { data: costsMonth }] = await Promise.all([
    admin.from("cost_log").select("cost_usd, service").gte("created_at", sinceToday),
    admin.from("cost_log").select("cost_usd").gte("created_at", sinceWeek),
    admin.from("cost_log").select("cost_usd").gte("created_at", sinceMonth),
  ]);
  const sum = (rs: { cost_usd: number | null }[] | null) =>
    (rs ?? []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const todayUsd = sum(costsToday);
  const weekUsd = sum(costsWeek);
  const monthUsd = sum(costsMonth);
  const todayByService: Record<string, number> = {};
  for (const r of costsToday ?? []) {
    const k = r.service ?? "unknown";
    todayByService[k] = (todayByService[k] ?? 0) + (Number(r.cost_usd) || 0);
  }

  // 4) 환각 차단율 (24h)
  const { data: convs } = await admin
    .from("tutor_conversations")
    .select("rejected_count, total_messages")
    .gte("last_active_at", since24h)
    .limit(1000);
  const totalMsg = (convs ?? []).reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const totalRej = (convs ?? []).reduce((s, c) => s + (c.rejected_count ?? 0), 0);
  const rejectPct = totalMsg > 0 ? (totalRej / totalMsg) * 100 : 0;

  // 5) 헬스 ping
  let health: { status: string; total_latency_ms: number; checks: Check[] } | null = null;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
    const r = await fetch(`${base}/api/health`, { cache: "no-store" });
    health = await r.json();
  } catch {}

  // 6) 최근 인시던트 (open)
  const { data: openIncidents } = await admin
    .from("incidents")
    .select("id, level, title, category, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">실시간 모니터링</h1>
          <p className="mt-1 text-sm text-muted-foreground">10초마다 새로고침 권장</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
      </header>

      {/* 실시간 위젯 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase text-muted-foreground">동시 활성 (1m)</div>
            <div className="mt-2 text-3xl font-bold">{activeConvs ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase text-muted-foreground">API 호출 (1m)</div>
            <div className="mt-2 text-3xl font-bold">{callsLastMin ?? 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">{callsLastHour ?? 0} / 시간</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase text-muted-foreground">환각 차단율 (24h)</div>
            <div className="mt-2 text-3xl font-bold">{rejectPct.toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">{totalRej} / {totalMsg}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase text-muted-foreground">시스템 상태</div>
            <div className={`mt-2 text-2xl font-bold ${
              health?.status === "healthy" ? "text-emerald-600" :
              health?.status === "degraded" ? "text-amber-600" : "text-red-600"
            }`}>
              {health?.status ?? "unknown"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{health?.total_latency_ms ?? 0}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* 비용 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">비용 누적</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-xs uppercase text-muted-foreground">오늘</div>
              <div className="text-2xl font-bold mt-1">${todayUsd.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">7일</div>
              <div className="text-2xl font-bold mt-1">${weekUsd.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">이번 달</div>
              <div className="text-2xl font-bold mt-1">${monthUsd.toFixed(2)}</div>
            </div>
          </div>
          {Object.keys(todayByService).length > 0 && (
            <ul className="mt-6 space-y-1 text-sm">
              {Object.entries(todayByService).sort(([, a], [, b]) => b - a).map(([s, v]) => (
                <li key={s} className="flex justify-between">
                  <span>{s}</span>
                  <span className="font-mono">${v.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 헬스 체크 상세 */}
      {health && (
        <Card>
          <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">의존성 상태</h2></CardHeader>
          <CardContent className="px-6 pb-6">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b">
                <th className="py-2">서비스</th><th>상태</th><th className="text-right">지연(ms)</th><th>상세</th>
              </tr></thead>
              <tbody>
                {(health.checks ?? []).map((c) => (
                  <tr key={c.name} className="border-b">
                    <td className="py-2 font-mono">{c.name}</td>
                    <td>
                      <span className={
                        c.status === "ok" ? "text-emerald-600" :
                        c.status === "fail" ? "text-red-600" : "text-muted-foreground"
                      }>{c.status}</span>
                    </td>
                    <td className="text-right font-mono">{c.latency_ms}</td>
                    <td className="text-xs text-muted-foreground">{c.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 진행 중 인시던트 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">진행 중 인시던트</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!openIncidents || openIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음. 정상.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {openIncidents.map((i) => (
                <li key={i.id} className="flex items-center justify-between border-b py-2">
                  <span>
                    <span className={`font-mono mr-3 ${
                      i.level === "L4" ? "text-red-700 font-bold" :
                      i.level === "L3" ? "text-red-600" :
                      i.level === "L2" ? "text-amber-600" : "text-muted-foreground"
                    }`}>{i.level}</span>
                    <span className="font-semibold">{i.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({i.category})</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(i.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
