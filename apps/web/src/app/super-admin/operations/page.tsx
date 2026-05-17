import Link from "next/link";
import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();

  // B2C
  const [
    { count: students },
    { count: instructors },
    { data: studioJobs },
    { data: castJobs },
    { count: tutorConvs },
    { data: nps },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "instructor"),
    admin.from("studio_jobs").select("cost_usd, status").gte("created_at", since30),
    admin.from("cast_jobs").select("cost_usd").gte("created_at", since30),
    admin.from("tutor_conversations").select("id", { count: "exact", head: true }).gte("created_at", since30),
    admin.from("nps_responses").select("score").gte("created_at", since30),
  ]);

  // B2B (sales pipeline + tenants)
  const [
    { count: tenants },
    { data: leads },
    { data: cases },
  ] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).neq("tenant_type", "internal"),
    admin.from("sales_leads").select("stage, estimated_arr_krw"),
    admin.from("case_studies").select("id, published"),
  ]);

  // Resources / cost
  const studioCost = (studioJobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
  const castCost = (castJobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
  const totalCost = studioCost + castCost;
  const studioCompleted = (studioJobs ?? []).filter((j) => j.status === "completed").length;
  const successRate = (studioJobs ?? []).length > 0 ? (studioCompleted / studioJobs!.length) * 100 : 0;

  // NPS
  const npsScores = (nps ?? []).map((r) => r.score as number);
  const promoters = npsScores.filter((s) => s >= 9).length;
  const detractors = npsScores.filter((s) => s <= 6).length;
  const npsValue = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;

  // Incidents
  const { data: incidents } = await admin
    .from("incidents")
    .select("severity, status")
    .gte("created_at", since30);
  const l3Plus = (incidents ?? []).filter((i) => ["L3", "L4", "P0", "P1"].includes((i.severity ?? "").toUpperCase())).length;

  // B2B pipeline
  const won = (leads ?? []).filter((l) => l.stage === "closed_won").length;
  const pipeline = (leads ?? []).filter((l) => !["closed_won", "closed_lost"].includes(l.stage)).length;
  const wonArr = (leads ?? []).filter((l) => l.stage === "closed_won").reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);

  // Customer checkins (7일 내 발송 예정)
  const { count: pendingCheckins } = await admin
    .from("customer_checkins")
    .select("id", { count: "exact", head: true })
    .is("sent_at", null)
    .lte("scheduled_for", new Date(Date.now() + 7 * 86400_000).toISOString());

  // Open renewal alerts
  const { count: renewalAlerts } = await admin
    .from("renewal_alerts")
    .select("id", { count: "exact", head: true })
    .is("acknowledged_at", null);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-purple-100 px-2 py-0.5 font-semibold text-purple-700">SUPER ADMIN</span>
          <span className="text-muted-foreground">W29-W30 · Gate G4-B 준비</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">통합 운영 대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">B2C + B2B + 자원 + 인시던트 + 고객 성공 자동화 일괄 조회.</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">B2C 지표 (30일)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="학생" value={(students ?? 0).toLocaleString()} target="목표 1,000" hit={(students ?? 0) >= 1000} />
          <Stat label="강사" value={(instructors ?? 0).toString()} />
          <Stat label="Studio (완)" value={`${studioCompleted}/${(studioJobs ?? []).length}`} sub={`성공률 ${successRate.toFixed(0)}%`} />
          <Stat label="Tutor 대화" value={(tutorConvs ?? 0).toLocaleString()} />
          <Stat label="B2C NPS" value={npsValue.toString()} target="목표 65+" hit={npsValue >= 65} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">B2B 지표</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="고객사" value={(won).toString()} target="목표 5+" hit={won >= 5} sub={`외부 테넌트 ${tenants ?? 0}`} />
          <Stat label="파이프라인" value={pipeline.toString()} sub="진행 중 리드" />
          <Stat label="수주 ARR" value={`₩${(wonArr / 1_0000_0000).toFixed(1)}억`} />
          <Stat label="Case Studies" value={(cases ?? []).filter((c) => c.published).length.toString()} sub={`전체 ${(cases ?? []).length}`} />
          <Stat label="갱신 알림" value={(renewalAlerts ?? 0).toString()} cls={(renewalAlerts ?? 0) > 0 ? "text-amber-600" : ""} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">자원 · 인시던트 (30일)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Studio 비용" value={`$${studioCost.toFixed(2)}`} />
          <Stat label="Cast 비용" value={`$${castCost.toFixed(2)}`} />
          <Stat label="총 AI 비용" value={`$${totalCost.toFixed(2)}`} cls="text-amber-700" />
          <Stat label="인시던트 L3+" value={l3Plus.toString()} target="목표 0" hit={l3Plus === 0} cls={l3Plus > 0 ? "text-red-600" : "text-emerald-600"} />
          <Stat label="체크인 대기" value={(pendingCheckins ?? 0).toString()} sub="7일 내" />
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link href="/super-admin/g4b-decision" className="block rounded-lg border-2 border-amber-400 bg-amber-50 p-5 hover:bg-amber-100">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700">▶ G4-B 게이트 결정</div>
          <div className="mt-1 text-lg font-bold">5개 관문 자동 평가 + 의사결정 기록</div>
          <p className="mt-1 text-xs text-muted-foreground">pass → Phase 4C · partial → 2주 보강 · fail</p>
        </Link>
        <Link href="/super-admin" className="block rounded-lg border bg-card p-5 hover:bg-muted">
          <div className="text-xs font-bold uppercase tracking-wider">테넌트 통합 관리</div>
          <div className="mt-1 text-lg font-bold">전체 테넌트 KPI + 신규 생성</div>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, target, hit, cls }: { label: string; value: string; sub?: string; target?: string; hit?: boolean; cls?: string }) {
  const indicator = hit === true ? "✓" : hit === false ? "✗" : "";
  const indCls = hit === true ? "text-emerald-600" : hit === false ? "text-red-600" : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls ?? ""}`}>{value} <span className={`text-xs ${indCls}`}>{indicator}</span></div>
      {target && <div className="text-[10px] text-muted-foreground">{target}</div>}
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
