import Link from "next/link";
import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

const PHASE4_START_DATE = "2026-01-01"; // 조정 가능 — 사업 시작일

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const sincePhase4 = `${PHASE4_START_DATE}T00:00:00Z`;
  const since24w = new Date(Date.now() - 24 * 7 * 86400_000).toISOString();

  // 누적 KPI
  const [
    { count: students },
    { count: instructors },
    { count: studioJobs },
    { count: castJobs },
    { count: tutorConvs },
    { data: nps },
    { data: wonLeads },
    { count: openLeads },
    { count: tenants },
    { count: hiredCount },
    { data: pnl },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "instructor"),
    admin.from("studio_jobs").select("id", { count: "exact", head: true }).gte("created_at", sincePhase4),
    admin.from("cast_jobs").select("id", { count: "exact", head: true }).gte("created_at", sincePhase4),
    admin.from("tutor_conversations").select("id", { count: "exact", head: true }).gte("created_at", sincePhase4),
    admin.from("nps_responses").select("score").gte("created_at", since24w),
    admin.from("sales_leads").select("estimated_arr_krw, closed_at").eq("stage", "closed_won").gte("closed_at", sincePhase4),
    admin.from("sales_leads").select("id", { count: "exact", head: true }).not("stage", "in", '("closed_won","closed_lost")'),
    admin.from("tenants").select("id", { count: "exact", head: true }).neq("tenant_type", "internal"),
    admin.from("hires").select("id", { count: "exact", head: true }).eq("stage", "onboarded"),
    admin.from("pnl_snapshots").select("period, b2c_revenue_krw, b2b_revenue_krw, ai_cost_krw, personnel_cost_krw, marketing_cost_krw, infra_cost_krw, other_cost_krw"),
  ]);

  // NPS
  const scores = (nps ?? []).map((r) => r.score as number);
  const npsValue = scores.length > 0
    ? Math.round(((scores.filter((s) => s >= 9).length - scores.filter((s) => s <= 6).length) / scores.length) * 100)
    : 0;

  // 매출
  const wonArr = (wonLeads ?? []).reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);
  const totalRev = (pnl ?? []).reduce((s, p) => s + Number(p.b2c_revenue_krw ?? 0) + Number(p.b2b_revenue_krw ?? 0), 0);
  const totalCost = (pnl ?? []).reduce((s, p) =>
    s + Number(p.ai_cost_krw ?? 0) + Number(p.personnel_cost_krw ?? 0) +
    Number(p.marketing_cost_krw ?? 0) + Number(p.infra_cost_krw ?? 0) + Number(p.other_cost_krw ?? 0), 0);
  const profit = totalRev - totalCost;

  // 인시던트
  const { count: incidents } = await admin.from("incidents").select("id", { count: "exact", head: true }).gte("created_at", sincePhase4);

  // 마케팅
  const { data: campaigns } = await admin.from("marketing_campaigns").select("spend_krw, signups, paid_conversions");
  const mktSpend = (campaigns ?? []).reduce((s, c) => s + Number(c.spend_krw ?? 0), 0);
  const mktSignups = (campaigns ?? []).reduce((s, c) => s + Number(c.signups ?? 0), 0);
  const cac = mktSignups > 0 ? Math.round(mktSpend / mktSignups) : 0;

  // 콘텐츠
  const { count: blogPosts } = await admin.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published");
  const { count: pressMentions } = await admin.from("press_mentions").select("id", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 print:max-w-none">
      <header className="mb-8 flex items-start justify-between print:mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-purple-700">GATE G4-C · FINAL</span>
          <h1 className="mt-1 text-4xl font-bold print:text-3xl">Phase 4 종합 보고서</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            24주 누적 (Phase 4 시작 {PHASE4_START_DATE} 기준) · 이사회 발표용
          </p>
        </div>
        <PrintButton />
      </header>

      <Section title="1. Executive Summary · Phase 4 KPI">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI label="B2C 학생" value={(students ?? 0).toLocaleString()} target="1,000" hit={(students ?? 0) >= 1000} />
          <KPI label="B2B 고객사 (수주)" value={(wonLeads ?? []).length.toString()} target="5+" hit={(wonLeads ?? []).length >= 5} />
          <KPI label="누적 매출" value={`₩${(totalRev / 1_0000_0000).toFixed(1)}억`} target="5억+" hit={totalRev >= 500_000_000} />
          <KPI label="누적 이익" value={`₩${(profit / 1_0000_0000).toFixed(1)}억`} cls={profit >= 0 ? "text-emerald-600" : "text-red-600"} />
          <KPI label="B2C NPS" value={npsValue.toString()} target="65+" hit={npsValue >= 65} />
          <KPI label="강사" value={(instructors ?? 0).toString()} />
          <KPI label="외부 테넌트" value={(tenants ?? 0).toString()} />
          <KPI label="인시던트 누적" value={(incidents ?? 0).toString()} />
        </div>
      </Section>

      <Section title="2. B2C · B2B 성과">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md border bg-blue-50 p-4">
            <h3 className="mb-2 font-bold text-blue-900">B2C</h3>
            <dl className="space-y-1 text-xs">
              <Row label="학생" value={(students ?? 0).toLocaleString()} />
              <Row label="Studio 작업 (24주)" value={(studioJobs ?? 0).toLocaleString()} />
              <Row label="Cast 영상 (24주)" value={(castJobs ?? 0).toLocaleString()} />
              <Row label="Tutor 대화 (24주)" value={(tutorConvs ?? 0).toLocaleString()} />
              <Row label="블로그 발행" value={(blogPosts ?? 0).toString()} />
              <Row label="마케팅 집행" value={`₩${(mktSpend / 1_0000_000).toFixed(1)}M`} />
              <Row label="CAC" value={cac > 0 ? `₩${cac.toLocaleString()}` : "—"} />
            </dl>
          </div>
          <div className="rounded-md border bg-purple-50 p-4">
            <h3 className="mb-2 font-bold text-purple-900">B2B</h3>
            <dl className="space-y-1 text-xs">
              <Row label="수주 (closed_won)" value={(wonLeads ?? []).length.toString()} />
              <Row label="진행 중 리드" value={(openLeads ?? 0).toString()} />
              <Row label="수주 ARR 합계" value={`₩${(wonArr / 1_0000_0000).toFixed(1)}억`} />
              <Row label="외부 테넌트" value={(tenants ?? 0).toString()} />
              <Row label="언론 언급" value={(pressMentions ?? 0).toString()} />
            </dl>
          </div>
        </div>
      </Section>

      <Section title="3. 매출 vs 계획">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Card label="총 매출 (실적)" value={`₩${(totalRev / 1_0000_0000).toFixed(1)}억`} />
          <Card label="총 비용 (실적)" value={`₩${(totalCost / 1_0000_0000).toFixed(1)}억`} />
          <Card label="이익" value={`₩${(profit / 1_0000_0000).toFixed(1)}억`} cls={profit >= 0 ? "text-emerald-600" : "text-red-600"} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">월별 P&L 상세: <Link href="/super-admin/pnl" className="text-blue-600 hover:underline">/super-admin/pnl</Link></p>
      </Section>

      <Section title="4. 인력 · 조직 변화">
        <p className="text-sm">
          시작 시 KEG TF (5~8명) → Phase 4 동안 ai-studio 사업부 신설 → 현재 입사 {hiredCount ?? 0}명 + 시드 11명.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">조직도: <Link href="/super-admin/org-chart" className="text-blue-600 hover:underline">/super-admin/org-chart</Link></p>
      </Section>

      <Section title="5. 시장 학습">
        <ul className="ml-4 list-disc text-sm space-y-1">
          <li>B2C: 한국 자격증·직무·언어 5개 카테고리 검증 — 학생 NPS·완주율 확인 가능</li>
          <li>B2B: 첫 영업 사이클 6~12개월. 케이스 스터디 1~2건이 다음 영업 가속</li>
          <li>글로벌: 베트남이 진입 비용·한류 영향에서 가장 유리 (W35 검토)</li>
          <li>강사: AI는 대체가 아닌 격상 도구로 인식되어야 채택률 ↑</li>
        </ul>
      </Section>

      <Section title="6. Phase 5 권장사항">
        <ul className="ml-4 list-disc text-sm space-y-1">
          <li>학생 5,000명·B2B 50개사 (5x 성장) → 인력 25명·매출 50억·이익 15억</li>
          <li>베트남 1국 시범 진출 — Q3 결정 게이트</li>
          <li>차차년도 분사 검토 (Phase 5 종료 시점)</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          상세 로드맵: <Link href="/super-admin/phase5-prep" className="text-blue-600 hover:underline">/super-admin/phase5-prep</Link> ·
          사업 계획서: <Link href="/super-admin/annual-plan" className="text-blue-600 hover:underline">/super-admin/annual-plan</Link>
        </p>
      </Section>

      <Section title="7. Gate G4-C 의사결정">
        <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm">3 옵션 — 이사회 선택:</p>
          <ul className="ml-4 mt-2 list-disc text-sm space-y-1">
            <li><b>GO (정식 출범):</b> 차년도 사업 계획 승인 · 25명 채용 · 분사 검토 · 베트남 진입</li>
            <li><b>HOLD:</b> 1분기 보강 후 재평가</li>
            <li><b>PIVOT:</b> B2C 또는 B2B 집중 (다른 영역 종료)</li>
            <li><b>STOP:</b> Phase 5 진행 보류 · 본부 환원</li>
          </ul>
          <p className="mt-3 text-xs">
            결정 입력: <Link href="/super-admin/g4c-decision" className="text-blue-600 hover:underline font-semibold">/super-admin/g4c-decision →</Link>
          </p>
        </div>
      </Section>

      <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground print:mt-6">
        <div>ai-studio · Gate G4-C 종합 보고서 · 작성 {new Date().toLocaleDateString("ko-KR")}</div>
        <div className="mt-1">검토: 사업부장 · 승인: CEO·이사회</div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-lg border bg-card p-6 print:mb-4 print:break-inside-avoid">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function KPI({ label, value, target, hit, cls }: { label: string; value: string; target?: string; hit?: boolean; cls?: string }) {
  const indCls = hit === true ? "text-emerald-600" : hit === false ? "text-red-600" : "";
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls ?? indCls}`}>{value} {hit !== undefined && (hit ? "✓" : "✗")}</div>
      {target && <div className="text-[10px] text-muted-foreground">목표 {target}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-semibold">{value}</dd>
    </div>
  );
}

function Card({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-md border bg-card p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls ?? ""}`}>{value}</div>
    </div>
  );
}
