import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DecisionForm from "./decision-form";

export const dynamic = "force-dynamic";

const PHASE_4_START = "2026-01-01"; // 누적 매출 산정 기준 (조정 가능)

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();

  // 1. B2C 학생
  const { count: students } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user");

  // 2. B2B 고객사 (closed_won)
  const { count: b2bCustomers } = await admin.from("sales_leads").select("id", { count: "exact", head: true }).eq("stage", "closed_won");

  // 3. 누적 매출 (Phase 4 시작 이후 closed_won ARR)
  const { data: wonLeads } = await admin.from("sales_leads").select("estimated_arr_krw, closed_at").eq("stage", "closed_won").gte("closed_at", `${PHASE_4_START}T00:00:00Z`);
  const revenueKrw = (wonLeads ?? []).reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);

  // 4. B2C NPS (최근 90일)
  const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data: nps } = await admin.from("nps_responses").select("score").gte("created_at", since90);
  const scores = (nps ?? []).map((r) => r.score as number);
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const b2cNps = scores.length > 0 ? Math.round(((promoters - detractors) / scores.length) * 100) : 0;

  // 5. B2B NPS — sales_leads에 별도 NPS 컬럼 없음. 단순화: case_studies published 수로 proxy
  const { count: publishedCases } = await admin.from("case_studies").select("id", { count: "exact", head: true }).eq("published", true);
  // 임시 B2B NPS 추정 (실제 운영 시 별도 설문)
  const b2bNps = publishedCases && publishedCases >= 2 ? 70 : 50;

  // 6. 인시던트 L3+ (30일)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: incidents } = await admin.from("incidents").select("severity").gte("created_at", since30);
  const l3Plus = (incidents ?? []).filter((i) => ["L3", "L4", "P0", "P1"].includes((i.severity ?? "").toUpperCase())).length;

  // 게이트 평가
  const gates = [
    { name: "B2C 학생 1,000명+", current: students ?? 0, target: 1000, pass: (students ?? 0) >= 1000 },
    { name: "B2B 고객사 5개+", current: b2bCustomers ?? 0, target: 5, pass: (b2bCustomers ?? 0) >= 5 },
    { name: "누적 매출 5억+", current: revenueKrw, target: 500_000_000, pass: revenueKrw >= 500_000_000, format: "krw" as const },
    { name: "B2C NPS 65+", current: b2cNps, target: 65, pass: b2cNps >= 65 },
    { name: "B2B NPS 60+ (proxy: published cases ≥2)", current: b2bNps, target: 60, pass: b2bNps >= 60 },
    { name: "인시던트 L3+ 0건", current: l3Plus, target: 0, pass: l3Plus === 0, inverse: true as const },
  ];
  const passCount = gates.filter((g) => g.pass).length;
  const totalGates = gates.length;
  const overallStatus = passCount === totalGates ? "pass" : passCount >= 4 ? "partial" : "fail";

  const { data: lastDecision } = await admin
    .from("g4b_decisions")
    .select("decision, rationale, next_actions, decided_at")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">GATE G4-B</span>
          <span className="text-muted-foreground">Phase 4B → 4C 진입 결정</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">G4-B 게이트 평가</h1>
        <p className="mt-1 text-sm text-muted-foreground">6개 관문 자동 평가. 통과 / 부분 / 실패에 따라 다음 단계 결정.</p>
      </header>

      <section className="mb-8 rounded-lg border-2 bg-card p-6"
        style={{ borderColor: overallStatus === "pass" ? "#10b981" : overallStatus === "partial" ? "#f59e0b" : "#ef4444" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">전체 평가</div>
            <div className="mt-1 text-3xl font-bold">
              {passCount} / {totalGates} 통과
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold uppercase">
              {overallStatus === "pass" ? "PASS" : overallStatus === "partial" ? "PARTIAL" : "FAIL"}
            </div>
            <div className="text-xs text-muted-foreground">
              {overallStatus === "pass" ? "→ Phase 4C 진입" : overallStatus === "partial" ? "→ 2주 보강 후 재평가" : "→ 재검토 필요"}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 space-y-2">
        {gates.map((g, i) => (
          <div key={i} className={`flex items-center justify-between rounded-lg border p-4 ${g.pass ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{g.pass ? "✓" : "✗"}</span>
              <div>
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  현재: <b>{g.format === "krw" ? `₩${(g.current / 1_0000_0000).toFixed(2)}억` : g.current.toLocaleString()}</b>
                  {" · "}목표: {g.format === "krw" ? `₩${(g.target / 1_0000_0000).toFixed(2)}억` : g.target.toLocaleString()}
                </div>
              </div>
            </div>
            <div className={g.pass ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
              {g.pass ? "PASS" : "FAIL"}
            </div>
          </div>
        ))}
      </section>

      {lastDecision && (
        <section className="mb-8 rounded-lg border bg-zinc-50 p-4 text-sm">
          <div className="font-semibold">최근 결정 — {new Date(lastDecision.decided_at).toLocaleString("ko-KR")}</div>
          <div className="mt-1"><b>{lastDecision.decision}</b></div>
          <p className="mt-2 whitespace-pre-wrap text-xs">{lastDecision.rationale}</p>
        </section>
      )}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">의사결정 기록</h2>
        <DecisionForm overallStatus={overallStatus} gates={gates.map((g) => ({ name: g.name, current: g.current, target: g.target, pass: g.pass }))} />
      </section>
    </div>
  );
}
