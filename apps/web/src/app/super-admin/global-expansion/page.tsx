import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

const REGION_LABEL: Record<string, string> = {
  southeast_asia: "동남아",
  china_zone: "중화권",
  japan: "일본",
  english: "영어권",
};

const DEMAND_LABEL: Record<string, string> = {
  korean_lang: "한국어 교육",
  certification: "자격증",
  esl: "ESL",
  k_content: "K-콘텐츠 학습",
};

const COMP_CLS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: markets }, { data: scenarios }] = await Promise.all([
    admin.from("global_markets").select("*").order("region").order("market_size_usd_m", { ascending: false }),
    admin.from("global_scenarios").select("*").order("investment_krw"),
  ]);

  // 권역별 그룹
  const byRegion = (markets ?? []).reduce<Record<string, typeof markets>>((acc, m) => {
    (acc[m.region] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 print:max-w-none">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W35 · GLOBAL REVIEW</span>
          <h1 className="mt-1 text-3xl font-bold print:text-2xl">글로벌 진출 검토</h1>
          <p className="mt-1 text-sm text-muted-foreground">실행 X · 분석 자료 (이사회 보고용).</p>
        </div>
        <PrintButton />
      </header>

      {/* 권역별 시장 */}
      {Object.entries(byRegion).map(([region, list]) => (
        <section key={region} className="mb-10">
          <h2 className="mb-3 text-xl font-bold">
            {REGION_LABEL[region] ?? region} <span className="text-sm font-normal text-muted-foreground">({(list ?? []).length}개국)</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">국가</th>
                  <th className="px-3 py-2 text-right">인구 (M)</th>
                  <th className="px-3 py-2 text-right">한류 지수</th>
                  <th className="px-3 py-2 text-right">시장 (USD M)</th>
                  <th className="px-3 py-2 text-left">주요 수요</th>
                  <th className="px-3 py-2 text-left">경쟁</th>
                  <th className="px-3 py-2 text-right">진출 비용</th>
                  <th className="px-3 py-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody>
                {(list ?? []).map((m) => (
                  <tr key={m.country_code} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{m.country} <span className="text-xs text-muted-foreground">({m.country_code})</span></td>
                    <td className="px-3 py-2 text-right font-mono">{m.population_m?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.k_wave_index}/10</td>
                    <td className="px-3 py-2 text-right font-mono">${m.market_size_usd_m?.toLocaleString()}M</td>
                    <td className="px-3 py-2 text-xs">{DEMAND_LABEL[m.primary_demand] ?? m.primary_demand}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${COMP_CLS[m.competition_level]}`}>{m.competition_level}</span></td>
                    <td className="px-3 py-2 text-right font-mono">₩{((m.entry_cost_krw ?? 0) / 1_0000_0000).toFixed(1)}억</td>
                    <td className="px-3 py-2 text-xs max-w-md">{m.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* 시나리오별 ROI */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold">진출 시나리오 ROI 시뮬레이션</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(scenarios ?? []).map((s) => {
            const targetList = (s.target_countries as string[]) ?? [];
            const inv = Number(s.investment_krw);
            const r12 = Number(s.projected_revenue_12m_krw ?? 0);
            const r24 = Number(s.projected_revenue_24m_krw ?? 0);
            const r36 = Number(s.projected_revenue_36m_krw ?? 0);
            const roi36 = inv > 0 ? Math.round(((r36 - inv) / inv) * 100) : 0;
            return (
              <div key={s.id} className="rounded-lg border bg-card p-5">
                <h3 className="text-lg font-bold">{s.scenario_name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {targetList.map((c) => <span key={c} className="rounded bg-blue-100 px-2 py-0.5 text-xs">{c}</span>)}
                </div>
                <dl className="mt-4 space-y-1.5 text-sm font-mono">
                  <Row label="투자" value={`₩${(inv / 1_0000_0000).toFixed(1)}억`} />
                  <Row label="12M 매출" value={`₩${(r12 / 1_0000_0000).toFixed(1)}억`} />
                  <Row label="24M 매출" value={`₩${(r24 / 1_0000_0000).toFixed(1)}억`} />
                  <Row label="36M 매출" value={`₩${(r36 / 1_0000_0000).toFixed(1)}억`} />
                  <Row label="24M 학생 수" value={`${s.expected_students_24m?.toLocaleString()}명`} />
                  <Row label="36M ROI" value={`${roi36}%`} cls={roi36 >= 100 ? "text-emerald-700" : "text-amber-700"} />
                </dl>
                {s.risks && (
                  <div className="mt-3 rounded-md bg-red-50 p-2 text-xs">
                    <b>리스크:</b> {s.risks}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 다국어 강화 */}
      <section className="mb-10 rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-xl font-bold">다국어 강화 검토</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold mb-2">Tutor 언어 확장</div>
            <ul className="ml-4 list-disc text-xs space-y-1">
              <li>현재: 5개 언어 (한·영·일·중·베트남)</li>
              <li>1단계 추가: 인니·태국·말레이 (동남아)</li>
              <li>2단계 추가: 스페인·포르투갈·아랍 (글로벌 ESL)</li>
              <li>비용: 언어당 RAG corpus + UI 번역 약 ₩20M</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">UI·결제·법무</div>
            <ul className="ml-4 list-disc text-xs space-y-1">
              <li>UI 다국어화: next-intl 도입 (₩30M)</li>
              <li>결제: Stripe(글로벌) + 현지 게이트웨이</li>
              <li>법무: 각국 개인정보 보호법 (GDPR · PDPA · 베트남 법령)</li>
              <li>총 추정: 1국당 ₩2~3억 (인력 제외)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 권장 사항 */}
      <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6">
        <h2 className="mb-2 text-xl font-bold text-amber-900">권장 진출 순서</h2>
        <ol className="ml-4 list-decimal space-y-2 text-sm">
          <li><b>1차 (Year 1):</b> 베트남 진출 — 한류 강세 + 진출 비용 낮음 + 한국어/한식 자격증 직결</li>
          <li><b>2차 (Year 2):</b> 인도네시아 + 태국 — 베트남 학습 자산 재활용. 동남아 권역 확장</li>
          <li><b>3차 (Year 3):</b> 일본 — 한국어 시장 큼 + 일본어 양방향 가능</li>
          <li><b>보류:</b> 미국·영국 — 경쟁 매우 치열. Year 3 이후 자금·브랜드 확보 후 재검토</li>
        </ol>
        <p className="mt-4 text-xs text-amber-800">
          이 검토는 W35 분석 자료입니다. 실제 진출 의사결정은 G5 게이트 (Phase 5)에서 진행.
        </p>
      </section>

      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground print:mt-4">
        <div>ai-studio · 글로벌 진출 검토 보고서 v1.0 · {new Date().toLocaleDateString("ko-KR")}</div>
        <div className="mt-1">⚠ 시장 규모·진출 비용은 산업 리서치 추정값. 실 진출 전 정밀 검증 필요.</div>
      </footer>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${cls ?? ""}`}>{value}</dd>
    </div>
  );
}
