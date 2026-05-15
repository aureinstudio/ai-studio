import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buildG2FinalReport } from "@/lib/kpi/g2-report";
import DecisionForm from "./form";

export const dynamic = "force-dynamic";

export default async function G2DecisionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/g2-decision");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const r = await buildG2FinalReport(admin, 28);

  // 기존 G2 결정 이력
  const { data: history } = await admin
    .from("decision_log")
    .select("id, decision, rationale, next_actions, decided_at, attendees")
    .eq("gate_id", "G2")
    .order("decided_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gate G2 의사결정</h1>
          <p className="mt-1 text-sm text-muted-foreground">Final Report 기반 — 결정은 영구 기록됩니다.</p>
        </div>
        <Link href="/admin/g2-final-report" className="text-sm hover:underline">Final Report →</Link>
      </header>

      {/* 자동 권장 */}
      <Card className={
        r.recommendation.decision === "GO" ? "border-emerald-300 bg-emerald-50" :
        r.recommendation.decision === "HOLD" ? "border-amber-300 bg-amber-50" :
        "border-red-300 bg-red-50"
      }>
        <CardHeader className="px-6 pt-6">
          <div className="text-xs uppercase opacity-70">시스템 자동 권장</div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="text-5xl font-extrabold">{r.recommendation.decision}</div>
          <p className="mt-3 text-sm">{r.recommendation.rationale}</p>
          <p className="mt-2 text-xs opacity-70">
            G2 조건 {r.g2_pass_count}/4 충족 · 가설 {r.hypotheses_passed}/5 통과 ·
            NPS {r.nps.value !== null ? r.nps.value.toFixed(1) : "—"} (n={r.nps.sample_size}) ·
            SME 합격 {r.sme.pass_rate_pct !== null ? `${r.sme.pass_rate_pct.toFixed(0)}%` : "—"}
          </p>
        </CardContent>
      </Card>

      {/* 조건 매트릭스 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">통과 조건 vs 현재</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <ul className="space-y-3">
            {r.g2_conditions.map((c) => (
              <li key={c.key} className="flex items-start gap-3">
                <span className={`mt-0.5 text-lg ${c.pass ? "text-emerald-600" : "text-red-600"}`}>
                  {c.pass ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${c.pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {c.pass ? "PASS" : "FAIL"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 결정 폼 */}
      <DecisionForm
        recommended={r.recommendation.decision}
        recommendedRationale={r.recommendation.rationale}
        kpiSnapshot={{
          g2_pass_count: r.g2_pass_count,
          hypotheses_passed: r.hypotheses_passed,
          nps: r.nps,
          sme: r.sme,
          totals: r.totals,
          g2_conditions: r.g2_conditions,
        }}
      />

      {/* 기존 결정 이력 */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">G2 결정 이력</h2></CardHeader>
          <CardContent className="px-6 pb-6">
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="py-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      h.decision === "GO" ? "bg-emerald-100 text-emerald-700" :
                      h.decision === "HOLD" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{h.decision}</span>
                    <span className="text-xs text-muted-foreground">{new Date(h.decided_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{h.rationale}</p>
                  {h.next_actions && (
                    <p className="text-xs text-muted-foreground mt-1">다음 단계: {h.next_actions}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
