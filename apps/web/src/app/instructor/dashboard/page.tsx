import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InstructorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/dashboard");
  const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  // 최근 활성 대화 (강사가 담당하는 과정 학생들)
  const { data: activeConvs } = await admin
    .from("tutor_conversations")
    .select("id, student_id, studio_job_id, total_messages, rejected_count, last_active_at, studio_jobs!inner(topic)")
    .gte("last_active_at", since7d)
    .order("last_active_at", { ascending: false })
    .limit(50);

  // 위험 알림 (강사에게 라우팅된 것)
  const { data: alerts } = await admin
    .from("admin_alerts")
    .select("id, alert_type, severity, student_id, evidence, recommended_intervention, dropout_risk_score, created_at, acknowledged_at")
    .eq("alert_target", "instructor")
    .gte("created_at", since14d)
    .is("acknowledged_at", null)
    .order("severity", { ascending: false })
    .limit(20);

  // 미확인 콘텐츠 신고
  const { count: reportsPending } = await admin
    .from("content_reports")
    .select("*", { count: "exact", head: true })
    .is("reviewed_at", null);

  // 강사 본인 주간 보고 상태
  const week = (() => {
    const d = new Date();
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const w = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
  })();
  const { data: weekReport } = await admin
    .from("instructor_usage_reports")
    .select("id")
    .eq("instructor_id", user.id)
    .eq("week_iso", week)
    .maybeSingle();

  // W13 — 본인 KPI / 인센티브
  const period = new Date().toISOString().slice(0, 7);
  const [{ data: myIncentives }, { data: myNps }, { data: trainingProg }, { count: myProposals }] = await Promise.all([
    admin
      .from("instructor_incentives")
      .select("tier, amount_krw, bonus_percent, reason, period")
      .eq("instructor_id", user.id)
      .order("period", { ascending: false })
      .limit(6),
    admin.from("instructor_nps").select("efficiency_score, value_elevation_score, recommend_score, period").eq("instructor_id", user.id).eq("period", period).maybeSingle(),
    admin.from("instructor_training_progress").select("module_key").eq("instructor_id", user.id),
    admin.from("instructor_content_proposals").select("id", { count: "exact", head: true }).eq("instructor_id", user.id).eq("status", "approved"),
  ]);

  const trainingDone = (trainingProg ?? []).length;
  const trainingTotal = 5;
  const thisMonthIncentives = (myIncentives ?? []).filter((i) => i.period === period);
  const thisMonthAmount = thisMonthIncentives.reduce((s, i) => s + (i.amount_krw ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">강사 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.name ?? "강사"}님 · 담당 학생 모니터링 + 콘텐츠 검토
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/instructor/weekly-report" className="px-3 py-1.5 text-sm rounded bg-foreground text-background">📝 주간 보고</Link>
          <Link href="/instructor/proposals" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">💡 콘텐츠 제안</Link>
          <Link href="/instructor/assets" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">🎭 강사 자산</Link>
          <Link href="/instructor/training" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">🎓 교육</Link>
          <Link href="/instructors/community" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">💬 커뮤니티</Link>
          <Link href="/instructor/nps" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">📊 월간 NPS</Link>
          <Link href="/admin/runbook" className="px-3 py-1.5 text-sm rounded border hover:bg-muted">📚 매뉴얼</Link>
        </div>
      </header>

      {/* Hero CTA — Studio Pro (강사 직접 강의 만들기) */}
      <Link
        href="/studio-pro"
        className="block rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-amber-700 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              ⭐ Studio Pro · 강사 전용
            </p>
            <h2 className="text-2xl font-bold tracking-tight">내 자료로 강의 만들기</h2>
            <p className="mt-2 text-sm">
              PDF·PPT·텍스트 업로드 → AI 보강 → <b>본인 얼굴·목소리</b>로 영상 자동 합성.
              먼저 <Link href="/instructor/assets" className="underline">사진·음성 등록</Link>하면 모든 영상에 자동 적용됩니다.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-md sm:inline-block">
            지금 시작 →
          </span>
        </div>
      </Link>

      {/* W13 KPI 위젯 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">이번 달 인센티브</div>
            <div className="mt-1 text-2xl font-bold">₩{thisMonthAmount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {thisMonthIncentives.map((i) => i.tier).join(" + ") || "미확정"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">채택된 콘텐츠 제안</div>
            <div className="mt-1 text-2xl font-bold">{myProposals ?? 0}건</div>
            <Link href="/instructor/proposals" className="text-xs text-blue-600 hover:underline">새 제안 →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">교육 진척</div>
            <div className="mt-1 text-2xl font-bold">{trainingDone}/{trainingTotal}</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-emerald-500" style={{ width: `${(trainingDone / trainingTotal) * 100}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className={myNps ? "" : "border-amber-300 bg-amber-50/30"}>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{period} 본인 NPS</div>
            <div className={`mt-1 text-2xl font-bold ${myNps ? "text-emerald-600" : "text-amber-600"}`}>
              {myNps ? `${myNps.recommend_score}/10` : "미응답"}
            </div>
            {!myNps && <Link href="/instructor/nps" className="text-xs text-blue-600 hover:underline">지금 작성 →</Link>}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={weekReport ? "" : "border-amber-300 bg-amber-50/30"}>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">이번 주 보고</div>
            <div className={`mt-1 text-lg font-bold ${weekReport ? "text-emerald-600" : "text-amber-600"}`}>
              {weekReport ? "✓ 제출 완료" : "미제출"}
            </div>
            {!weekReport && (
              <Link href="/instructor/weekly-report" className="mt-1 text-xs text-blue-600 hover:underline">
                지금 작성 →
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">활성 대화 (7d)</div>
            <div className="mt-1 text-2xl font-bold">{(activeConvs ?? []).length}건</div>
          </CardContent>
        </Card>
        <Card className={(alerts?.length ?? 0) > 0 ? "border-red-300 bg-red-50/20" : ""}>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">미확인 위험 알림</div>
            <div className={`mt-1 text-2xl font-bold ${(alerts?.length ?? 0) > 0 ? "text-red-600" : ""}`}>
              {alerts?.length ?? 0}건
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">미검토 신고</div>
            <div className="mt-1 text-2xl font-bold">{reportsPending ?? 0}건</div>
          </CardContent>
        </Card>
      </div>

      {/* 위험 알림 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">미확인 위험 알림</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!alerts || alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음. 👍</p>
          ) : (
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      a.severity === "high" ? "bg-red-100 text-red-700" :
                      a.severity === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-zinc-100 text-zinc-700"
                    }`}>{a.severity}</span>
                    <span className="text-sm font-medium">{a.alert_type}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      student-{a.student_id.slice(0, 8)}
                    </span>
                  </div>
                  {a.recommended_intervention && (
                    <p className="text-xs text-muted-foreground">→ {a.recommended_intervention}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 최근 활성 대화 */}
      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">최근 활성 학생 대화 (7일)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!activeConvs || activeConvs.length === 0 ? (
            <p className="text-sm text-muted-foreground">활성 대화 없음.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">학생</th>
                  <th>과정</th>
                  <th className="text-right">메시지</th>
                  <th className="text-right">차단</th>
                  <th>최근 활성</th>
                </tr>
              </thead>
              <tbody>
                {activeConvs.slice(0, 20).map((c) => {
                  type T = { topic?: string };
                  const tj = Array.isArray(c.studio_jobs) ? c.studio_jobs[0] : (c.studio_jobs as T | null);
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{c.student_id.slice(0, 8)}…</td>
                      <td className="truncate max-w-xs">{tj?.topic ?? "—"}</td>
                      <td className="text-right font-mono">{c.total_messages ?? 0}</td>
                      <td className="text-right font-mono">
                        {(c.rejected_count ?? 0) > 0 ? (
                          <span className="text-amber-600">{c.rejected_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground font-mono">
                        {new Date(c.last_active_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
