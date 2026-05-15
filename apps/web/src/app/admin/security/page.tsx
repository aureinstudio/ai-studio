import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { COST_LIMITS } from "@/lib/cost-guard";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  user_id: string | null;
  endpoint: string;
  ip: string | null;
  blocked: boolean;
  threats: { category: string; severity: string; pattern: string }[];
  input_preview: string | null;
  created_at: string;
};

type CostAlertRow = {
  scope_key: string;
  ratio: number;
  current_usd: number;
  limit_usd: number;
  alert_date: string;
  user_id: string | null;
};

export default async function SecurityDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/security");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sinceToday = today.toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. audit_log — 최근 50건 + 통계
  const { data: auditAll } = await admin
    .from("audit_log")
    .select("id, user_id, endpoint, ip, blocked, threats, input_preview, created_at")
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(50);
  const audit = (auditAll ?? []) as AuditRow[];

  const blockedToday = audit.filter(
    (a) => a.blocked && new Date(a.created_at) >= today,
  ).length;
  const totalThreats7d = audit.length;

  // 위협 카테고리 카운트
  const categoryCount: Record<string, number> = {};
  for (const a of audit) {
    for (const t of a.threats ?? []) {
      categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1;
    }
  }

  // IP·user별 위반 누적 (top 5)
  const ipCount: Record<string, number> = {};
  const userCount: Record<string, number> = {};
  for (const a of audit) {
    if (a.ip) ipCount[a.ip] = (ipCount[a.ip] ?? 0) + 1;
    if (a.user_id) userCount[a.user_id] = (userCount[a.user_id] ?? 0) + 1;
  }
  const topIps = Object.entries(ipCount).sort(([, a], [, b]) => b - a).slice(0, 5);
  const topUsers = Object.entries(userCount).sort(([, a], [, b]) => b - a).slice(0, 5);

  // 2. cost_alerts — 오늘 + 7일 임계 도달 사용자
  const { data: costAlertsAll } = await admin
    .from("cost_alerts")
    .select("scope_key, ratio, current_usd, limit_usd, alert_date, user_id")
    .gte("alert_date", sinceToday.slice(0, 10))
    .order("ratio", { ascending: false })
    .limit(20);
  const costAlerts = (costAlertsAll ?? []) as CostAlertRow[];

  // 3. 활성 cost_overrides (현재 유효한 수동 해제)
  const { data: overrides } = await admin
    .from("cost_overrides")
    .select("user_id, scope_key, reason, expires_at, granted_by")
    .gte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">보안 감사</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rate limit · 입력 위협 · 비용 한도 모니터링 (최근 7일)
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 관리자 홈
        </Link>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              오늘 차단된 요청
            </div>
            <div className="mt-2 text-3xl font-bold">{blockedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              7일 위협 감지 총합
            </div>
            <div className="mt-2 text-3xl font-bold">{totalThreats7d}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              비용 임계 도달 (오늘+)
            </div>
            <div className="mt-2 text-3xl font-bold">{costAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 위협 카테고리 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">위협 카테고리 분포 (7일)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {Object.keys(categoryCount).length === 0 ? (
            <p className="text-sm text-muted-foreground">감지된 위협 없음.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(categoryCount)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, n]) => (
                  <li key={cat} className="flex justify-between">
                    <span className="text-foreground">{cat}</span>
                    <span className="font-mono text-muted-foreground">{n}회</span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Top 위반 IP·User */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="px-6 pt-6">
            <h2 className="text-lg font-semibold">Top 위반 IP</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {topIps.length === 0 ? (
              <p className="text-sm text-muted-foreground">없음</p>
            ) : (
              <ul className="space-y-1 text-sm font-mono">
                {topIps.map(([ip, n]) => (
                  <li key={ip} className="flex justify-between">
                    <span>{ip}</span>
                    <span className="text-muted-foreground">{n}회</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-6 pt-6">
            <h2 className="text-lg font-semibold">Top 위반 사용자</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">없음</p>
            ) : (
              <ul className="space-y-1 text-sm font-mono">
                {topUsers.map(([uid, n]) => (
                  <li key={uid} className="flex justify-between">
                    <span>{uid.slice(0, 8)}…</span>
                    <span className="text-muted-foreground">{n}회</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 비용 한도 + 임계 도달 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">비용 한도 · 임계 알림</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="text-xs text-muted-foreground">
            기준 한도: per-user daily ${COST_LIMITS.per_user_daily} · monthly ${COST_LIMITS.per_user_monthly} ·
            global daily ${COST_LIMITS.global_daily} · monthly ${COST_LIMITS.global_monthly} ·
            cast user daily ${COST_LIMITS.cast_user_daily} · cast global daily ${COST_LIMITS.cast_global_daily}
          </div>
          {costAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">임계 도달 없음.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">사용자</th>
                  <th>한도 키</th>
                  <th className="text-right">사용 / 한도</th>
                  <th className="text-right">비율</th>
                  <th>일자</th>
                </tr>
              </thead>
              <tbody>
                {costAlerts.map((a, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 font-mono text-xs">{a.user_id?.slice(0, 8) ?? "—"}</td>
                    <td className="font-mono text-xs">{a.scope_key}</td>
                    <td className="text-right font-mono">
                      ${Number(a.current_usd).toFixed(2)} / ${Number(a.limit_usd).toFixed(2)}
                    </td>
                    <td className="text-right">
                      <span className={Number(a.ratio) >= 1 ? "text-red-600 font-semibold" : "text-amber-600"}>
                        {Math.floor(Number(a.ratio) * 100)}%
                      </span>
                    </td>
                    <td className="font-mono text-xs">{a.alert_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 활성 override */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">활성 비용 한도 해제 (override)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!overrides || overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">활성 override 없음.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {overrides.map((o, i) => (
                <li key={i} className="font-mono">
                  user {o.user_id?.slice(0, 8)}… · {o.scope_key} · 만료 {new Date(o.expires_at).toLocaleString()}
                  {o.reason ? ` — ${o.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 최근 audit_log */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">최근 위협 감지 (최대 50건)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">감지된 위협 없음.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">시각</th>
                    <th>endpoint</th>
                    <th>IP</th>
                    <th>user</th>
                    <th>차단</th>
                    <th>위협</th>
                    <th>입력 미리보기</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-b align-top">
                      <td className="py-1 font-mono whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="font-mono">{a.endpoint}</td>
                      <td className="font-mono">{a.ip ?? "—"}</td>
                      <td className="font-mono">{a.user_id?.slice(0, 8) ?? "—"}</td>
                      <td>
                        {a.blocked ? (
                          <span className="text-red-600 font-semibold">차단</span>
                        ) : (
                          <span className="text-muted-foreground">감지</span>
                        )}
                      </td>
                      <td>
                        {(a.threats ?? []).map((t, j) => (
                          <div key={j} className="text-[10px]">
                            <span className="font-mono">{t.category}</span>
                            <span className="ml-1 text-muted-foreground">({t.severity})</span>
                          </div>
                        ))}
                      </td>
                      <td className="max-w-md truncate" title={a.input_preview ?? ""}>
                        {a.input_preview ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
