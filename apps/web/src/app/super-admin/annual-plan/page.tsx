import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const { year: yearStr } = await searchParams;
  const targetYear = Number(yearStr) || new Date().getFullYear() + 1;

  const admin = createAdminClient();
  const [planResp, quartersResp, b2cResp, b2bResp, hiresResp, coursesResp] = await Promise.all([
    admin.from("annual_plans").select("*").eq("target_year", targetYear).maybeSingle(),
    admin.from("quarterly_targets").select("*").order("quarter"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("sales_leads").select("id", { count: "exact", head: true }).eq("stage", "closed_won"),
    admin.from("hires").select("id", { count: "exact", head: true }).eq("stage", "onboarded"),
    admin.from("course_catalog").select("id", { count: "exact", head: true }).eq("status", "live"),
  ]);
  const plan = planResp.data;
  const quarters = quartersResp.data;
  const currentB2c = b2cResp.count ?? 0;
  const currentB2b = b2bResp.count ?? 0;
  const hires = hiresResp.count ?? 0;
  const courses = coursesResp.count ?? 0;

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">{targetYear}년 계획서 없음</h1>
        <p className="mt-2 text-muted-foreground">0048 마이그레이션 적용 + SQL Editor에서 annual_plans row 생성 필요.</p>
      </div>
    );
  }

  const planQuarters = (quarters ?? []).filter((q) => q.annual_plan_id === plan.id).sort((a, b) => a.quarter.localeCompare(b.quarter));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 print:max-w-none">
      <header className="mb-8 flex items-start justify-between print:mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W37 · ANNUAL PLAN</span>
          <h1 className="mt-1 text-4xl font-bold print:text-3xl">{targetYear}년 사업 계획서</h1>
          <p className="mt-1 text-sm text-muted-foreground">ai-studio 사업부 · 이사회 보고용 · v1.0</p>
        </div>
        <PrintButton />
      </header>

      {/* 1. Executive Summary */}
      <Section title="1. Executive Summary">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <KPI label="목표 학생 (B2C)" value={`${plan.target_b2c_students?.toLocaleString()}명`} current={`현재 ${currentB2c.toLocaleString()}`} />
          <KPI label="목표 고객사 (B2B)" value={`${plan.target_b2b_customers}개`} current={`현재 ${currentB2b}`} />
          <KPI label="목표 매출" value={`₩${(Number(plan.target_revenue_krw) / 1_0000_0000).toFixed(0)}억`} current={undefined} />
          <KPI label="목표 이익" value={`₩${(Number(plan.target_profit_krw) / 1_0000_0000).toFixed(0)}억`} current={undefined} />
          <KPI label="과정 수" value={`${plan.target_b2c_courses}개`} current={`현재 ${courses}`} />
          <KPI label="인력" value={`${plan.target_headcount}명`} current={`현재 ${hires + 11} (시드 11+입사 ${hires})`} />
        </div>
      </Section>

      {/* 2. 시장 분석 */}
      <Section title="2. 시장 분석">
        <p className="text-sm whitespace-pre-wrap">{plan.market_analysis}</p>
        <div className="mt-4 text-xs text-muted-foreground">상세 글로벌 분석: /super-admin/global-expansion</div>
      </Section>

      {/* 3. 분기별 KPI */}
      <Section title="3. 분기별 목표">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">분기</th>
              <th className="px-3 py-2 text-right">B2C 학생</th>
              <th className="px-3 py-2 text-right">B2B 고객사</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-left">주요 마일스톤</th>
            </tr>
          </thead>
          <tbody>
            {planQuarters.map((q) => (
              <tr key={q.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{q.quarter}</td>
                <td className="px-3 py-2 text-right font-mono">{q.b2c_students?.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">{q.b2b_customers}</td>
                <td className="px-3 py-2 text-right font-mono">₩{((Number(q.revenue_krw) ?? 0) / 1_0000_0000).toFixed(1)}억</td>
                <td className="px-3 py-2 text-xs">{q.milestone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 4. 조직 · 인력 */}
      <Section title="4. 조직 · 인력 계획">
        <p className="text-sm whitespace-pre-wrap">{plan.org_plan}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <Card label="총 인력" value={`${plan.target_headcount}명`} />
          <Card label="B2C팀" value="6명" sub="콘텐츠·운영·마케팅" />
          <Card label="B2B팀" value="10명" sub="영업·CSM·통합·기술" />
          <Card label="인프라팀" value="6명" sub="AI·DevOps·보안" />
        </div>
      </Section>

      {/* 5. 예산 */}
      <Section title="5. 예산 (KRW)">
        <table className="w-full text-sm">
          <tbody>
            <BudgetRow label="매출 (목표)" value={Number(plan.budget_revenue_krw)} positive />
            <BudgetRow label="인건비" value={-Number(plan.budget_personnel_krw)} />
            <BudgetRow label="인프라·AI" value={-Number(plan.budget_infra_krw)} />
            <BudgetRow label="마케팅" value={-Number(plan.budget_marketing_krw)} />
            <BudgetRow label="기타" value={-Number(plan.budget_other_krw)} />
            <BudgetRow
              label="이익"
              value={Number(plan.budget_revenue_krw) - Number(plan.budget_personnel_krw) - Number(plan.budget_infra_krw) - Number(plan.budget_marketing_krw) - Number(plan.budget_other_krw)}
              bold
            />
          </tbody>
        </table>
      </Section>

      {/* 6. 마일스톤 */}
      <Section title="6. 핵심 마일스톤">
        <p className="text-sm whitespace-pre-wrap">{plan.milestones}</p>
      </Section>

      {/* 7. 리스크 */}
      <Section title="7. 리스크 · 대응">
        <p className="text-sm whitespace-pre-wrap">{plan.risks}</p>
      </Section>

      {/* 8. 의사결정 게이트 */}
      <Section title="8. 의사결정 게이트">
        <p className="text-sm whitespace-pre-wrap">{plan.decision_gates}</p>
      </Section>

      <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground print:mt-6">
        <div>ai-studio 사업부 · {targetYear}년 사업 계획서 v1.0 · 작성 {new Date().toLocaleDateString("ko-KR")}</div>
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

function KPI({ label, value, current }: { label: string; value: string; current?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {current && <div className="text-[10px] text-muted-foreground">{current}</div>}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function BudgetRow({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  const isPos = value >= 0;
  return (
    <tr className={`border-b last:border-b-0 ${bold ? "border-t-2 border-t-foreground font-bold bg-emerald-50" : ""}`}>
      <td className="px-3 py-2">{label}</td>
      <td className={`px-3 py-2 text-right font-mono ${positive || (bold && isPos) ? "text-emerald-700" : isPos ? "" : "text-red-700"}`}>
        ₩{(Math.abs(value) / 1_0000_0000).toFixed(1)}억{value < 0 ? " ▼" : ""}
      </td>
    </tr>
  );
}
