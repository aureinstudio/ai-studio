import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildG2FinalReport } from "@/lib/kpi/g2-report";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function G2FinalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/g2-final-report");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const params = await searchParams;
  const windowDays = Number(params.days ?? "28");
  const admin = createAdminClient();
  const r = await buildG2FinalReport(admin, windowDays);

  const decisionColor = r.recommendation.decision === "GO" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : r.recommendation.decision === "HOLD" ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="bg-background">
      {/* 인쇄용 print 스타일 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page-break { page-break-before: always; }
          .card { break-inside: avoid; }
          a { color: inherit; text-decoration: none; }
        }
        @page { size: A4; margin: 16mm; }
      `}} />

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div className="no-print flex items-center justify-between">
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
          <div className="flex gap-2">
            <Link href="/admin/g2-decision" className="px-4 py-2 text-sm rounded bg-foreground text-background">의사결정 화면 →</Link>
            <PrintButton />
          </div>
        </div>

        {/* Executive Summary */}
        <header className="border-b pb-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Gate G2 — Final Report</div>
          <h1 className="text-4xl font-bold mt-2">KEG AI Studio · 베타 {windowDays}일 종합</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            생성 {new Date(r.generated_at).toLocaleString()} · 기간 {r.window.start.slice(0,10)} ~ {r.window.end.slice(0,10)}
          </p>
        </header>

        {/* 자동 권장 */}
        <section className={`border-2 rounded-lg p-6 ${decisionColor} card`}>
          <div className="text-xs uppercase tracking-widest opacity-70">자동 권장 결정</div>
          <div className="mt-2 text-5xl font-extrabold">{r.recommendation.decision}</div>
          <p className="mt-3 text-sm leading-relaxed">{r.recommendation.rationale}</p>
          <p className="mt-2 text-xs opacity-70">G2 조건 통과: {r.g2_pass_count} / 4 · 가설 통과: {r.hypotheses_passed} / 5</p>
        </section>

        {/* 1. 누적 통계 */}
        <section className="card">
          <h2 className="text-2xl font-bold mb-4">1. 베타 누적 통계</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="총 학생" value={`${r.totals.total_students}명`} />
            <Stat label="7일 활성" value={`${r.totals.active_students_7d}명`} />
            <Stat label="신규 가입" value={`${r.totals.new_signups}명`} />
            <Stat label="Studio 작업" value={`${r.totals.studio_jobs}건`} />
            <Stat label="Cast 영상" value={`${r.totals.cast_jobs}건`} />
            <Stat label="Tutor 메시지" value={`${r.totals.tutor_messages.toLocaleString()}건`} />
            <Stat label="환각 차단율" value={`${r.totals.tutor_reject_rate_pct.toFixed(1)}%`} />
            <Stat label="총 비용" value={`$${r.totals.cost_usd.toFixed(2)}`} />
          </div>
          <div className="mt-4 text-sm">
            <div className="flex justify-between mb-1">
              <span>월 예산 진행률</span>
              <span className={`font-mono ${r.totals.budget_used_pct >= 80 ? "text-red-600" : "text-muted-foreground"}`}>
                {r.totals.budget_used_pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded">
              <div
                className={`h-full rounded ${r.totals.budget_used_pct >= 80 ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, r.totals.budget_used_pct)}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. 5개 가설 */}
        <section className="card page-break">
          <h2 className="text-2xl font-bold mb-4">2. 5개 가설 Final 평가</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">ID</th>
                <th>지표</th>
                <th className="text-right">현재</th>
                <th>목표</th>
                <th className="text-right">표본</th>
                <th className="text-center">판정</th>
              </tr>
            </thead>
            <tbody>
              {r.hypotheses.map((h) => (
                <tr key={h.hypothesis_id} className="border-b">
                  <td className="py-3 font-mono font-bold">{h.hypothesis_id}</td>
                  <td>{h.metric_name}</td>
                  <td className="text-right font-mono">{h.value === null ? "—" : h.value.toFixed(2)}</td>
                  <td className="text-xs">{h.target_label}</td>
                  <td className="text-right font-mono">{h.sample_size}</td>
                  <td className="text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${h.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {h.passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 3. G2 조건 */}
        <section className="card">
          <h2 className="text-2xl font-bold mb-4">3. Gate G2 조건 ({r.g2_pass_count}/4 충족)</h2>
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
        </section>

        {/* 4. NPS 분포 */}
        <section className="card">
          <h2 className="text-2xl font-bold mb-4">4. 학생 NPS</h2>
          {r.nps.sample_size === 0 ? (
            <p className="text-sm text-muted-foreground">표본 없음.</p>
          ) : (
            <div className="grid grid-cols-4 gap-4 text-center">
              <Stat label="NPS" value={r.nps.value !== null ? r.nps.value.toFixed(1) : "—"} />
              <Stat label="Promoter (9-10)" value={`${r.nps.promoters}명`} />
              <Stat label="Passive (7-8)" value={`${r.nps.passives}명`} />
              <Stat label="Detractor (0-6)" value={`${r.nps.detractors}명`} />
            </div>
          )}
        </section>

        {/* 5. SME */}
        <section className="card">
          <h2 className="text-2xl font-bold mb-4">5. SME 콘텐츠 합격률</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="합격선 통과율" value={r.sme.pass_rate_pct !== null ? `${r.sme.pass_rate_pct.toFixed(1)}%` : "—"} />
            <Stat label="평가된 콘텐츠" value={`${r.sme.job_count}건`} />
            <Stat label="평균 평점" value={r.sme.avg_rating !== null ? `${r.sme.avg_rating.toFixed(2)} / 5` : "—"} />
          </div>
        </section>

        {/* 6. 인시던트 */}
        <section className="card page-break">
          <h2 className="text-2xl font-bold mb-4">6. 인시던트 이력</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <Stat label="총 인시던트" value={`${r.incidents.total}건`} />
            <Stat label="L3+ (위험)" value={`${r.incidents.l3_plus}건`} highlight={r.incidents.l3_plus > 0} />
            <Stat label="미해결" value={`${r.incidents.open}건`} highlight={r.incidents.open > 0} />
          </div>
          {Object.keys(r.incidents.by_category).length > 0 && (
            <div className="text-sm">
              <div className="font-semibold mb-2">카테고리별</div>
              <ul className="space-y-1">
                {Object.entries(r.incidents.by_category).map(([cat, n]) => (
                  <li key={cat} className="flex justify-between border-b py-1">
                    <span className="font-mono">{cat}</span>
                    <span>{n}건</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 7. 정성 피드백 */}
        <section className="card">
          <h2 className="text-2xl font-bold mb-4">7. 정성 피드백 (Top 5)</h2>
          <Quotes title="🟢 Promoter NPS 사유" items={r.qualitative.nps_promoter_quotes} empty="응답 부족" />
          <Quotes title="🔴 Detractor NPS 사유" items={r.qualitative.nps_detractor_quotes} empty="응답 부족" />
          <Quotes title="🟡 SME 개선 의견" items={r.qualitative.sme_improvements} empty="평가 부족" />
          <Quotes title="💡 학생이 어려워한 부분" items={r.qualitative.self_check_hardest} empty="자가 진단 부족" />
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground border-t pt-6">
          <p>KEG AI Studio · Gate G2 Final Report · {new Date(r.generated_at).toLocaleDateString()}</p>
          <p className="mt-1">자동 생성 · 인쇄 시 "PDF로 저장" 옵션 권장</p>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-3 bg-muted/40 rounded border">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

function Quotes({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="mb-5">
      <div className="font-semibold text-sm mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((q, i) => (
            <li key={i} className="border-l-4 pl-3 py-1 italic text-muted-foreground border-zinc-300">
              &ldquo;{q.slice(0, 240)}&rdquo;
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
