import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FounderDependencyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/founder-dependency");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();

  // 누가 admin인지 식별 (본부장 본인 + 다른 admin)
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  const adminIds = new Set((admins ?? []).map((a) => a.id));

  // 1. 베타 신청 검토 — beta_applications.reviewed_by 별
  const { data: betaReviews } = await admin
    .from("beta_applications")
    .select("reviewed_by, status")
    .not("reviewed_by", "is", null)
    .gte("reviewed_at", since30d);
  const betaByAdmin = (betaReviews ?? []).filter((b) => adminIds.has(b.reviewed_by!)).length;
  const betaByOps = (betaReviews ?? []).length - betaByAdmin;

  // 2. SME 검토 — sme_evaluations.evaluator_id 별
  const { data: smeReviews } = await admin
    .from("sme_evaluations")
    .select("evaluator_id")
    .not("evaluator_id", "is", null)
    .gte("created_at", since30d);
  const smeByAdmin = (smeReviews ?? []).filter((s) => adminIds.has(s.evaluator_id!)).length;
  const smeByOthers = (smeReviews ?? []).length - smeByAdmin;

  // 3. 콘텐츠 보완 — content_remediation_queue.resolved_by / triggered_by
  const { data: remediations } = await admin
    .from("content_remediation_queue")
    .select("triggered_by, resolved_by")
    .gte("created_at", since30d);
  const remedAdmin = (remediations ?? []).filter((r) => adminIds.has(r.resolved_by ?? r.triggered_by ?? "")).length;
  const remedOthers = (remediations ?? []).length - remedAdmin;

  // 4. 인시던트 ack — admin_alerts.acknowledged_by 별
  const { data: alertAcks } = await admin
    .from("admin_alerts")
    .select("acknowledged_by")
    .not("acknowledged_by", "is", null)
    .gte("created_at", since30d);
  const alertByAdmin = (alertAcks ?? []).filter((a) => adminIds.has(a.acknowledged_by!)).length;
  const alertByOthers = (alertAcks ?? []).length - alertByAdmin;

  // 종합 비율
  const totalAdminActions = betaByAdmin + smeByAdmin + remedAdmin + alertByAdmin;
  const totalOtherActions = betaByOps + smeByOthers + remedOthers + alertByOthers;
  const totalActions = totalAdminActions + totalOtherActions;
  const adminPct = totalActions > 0 ? (totalAdminActions / totalActions) * 100 : 0;
  const otherPct = 100 - adminPct;

  // 단계별 목표 (delegation-checklist에 명시)
  const stages = [
    { label: "W5~W6 (베타 시작)", target_admin: 80 },
    { label: "W7~W8 (Gate G2)", target_admin: 60 },
    { label: "W10 (셀프 서비스)", target_admin: 30 },
    { label: "Phase 3 후반 (목표)", target_admin: 15 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">본부장 의존도 측정</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            본부장 직접 처리 비율 추이 — 위임 성공도 정량화 (최근 30일)
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자</Link>
      </header>

      {/* 종합 카드 */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-xs uppercase text-muted-foreground">본부장 직접 처리</div>
              <div className={`mt-2 text-4xl font-bold ${
                adminPct <= 30 ? "text-emerald-600" : adminPct <= 60 ? "text-amber-600" : "text-red-600"
              }`}>{adminPct.toFixed(0)}%</div>
              <div className="mt-1 text-xs text-muted-foreground">{totalAdminActions}건</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">위임 처리</div>
              <div className={`mt-2 text-4xl font-bold ${
                otherPct >= 70 ? "text-emerald-600" : otherPct >= 40 ? "text-amber-600" : "text-zinc-500"
              }`}>{otherPct.toFixed(0)}%</div>
              <div className="mt-1 text-xs text-muted-foreground">{totalOtherActions}건</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">현재 단계 목표</div>
              <div className="mt-2 text-4xl font-bold">30%</div>
              <div className="mt-1 text-xs text-muted-foreground">W10 목표 (이하면 ✓)</div>
            </div>
          </div>
          {/* 진행 막대 */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>본부장</span>
              <span>위임</span>
            </div>
            <div className="h-3 bg-muted rounded overflow-hidden flex">
              <div
                className={`h-full ${adminPct <= 30 ? "bg-emerald-500" : adminPct <= 60 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${adminPct}%` }}
              />
              <div
                className="h-full bg-blue-500"
                style={{ width: `${otherPct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 행동별 세부 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">액션별 분포</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">액션</th>
                <th className="text-right">본부장</th>
                <th className="text-right">위임</th>
                <th className="text-right">위임률</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: "베타 신청 검토", a: betaByAdmin, o: betaByOps },
                { label: "SME 콘텐츠 검토", a: smeByAdmin, o: smeByOthers },
                { label: "콘텐츠 보완 처리", a: remedAdmin, o: remedOthers },
                { label: "위험 알림 확인", a: alertByAdmin, o: alertByOthers },
              ].map((row) => {
                const total = row.a + row.o;
                const delegPct = total > 0 ? (row.o / total) * 100 : 0;
                return (
                  <tr key={row.label}>
                    <td className="py-3">{row.label}</td>
                    <td className="text-right font-mono">{row.a}</td>
                    <td className="text-right font-mono">{row.o}</td>
                    <td className="text-right font-mono">
                      <span className={delegPct >= 70 ? "text-emerald-600" : delegPct >= 40 ? "text-amber-600" : "text-red-600"}>
                        {delegPct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 단계별 로드맵 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">위임 로드맵</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <ul className="space-y-3">
            {stages.map((s, i) => {
              const reached = adminPct <= s.target_admin;
              return (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    reached ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {reached ? "✓" : i + 1}
                  </span>
                  <span className={reached ? "text-foreground" : "text-muted-foreground"}>
                    {s.label} — 본부장 ≤ {s.target_admin}%
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground mt-4">
            상세 위임 매트릭스: <Link href="/admin/runbook?doc=delegation-checklist" className="underline">runbook</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
