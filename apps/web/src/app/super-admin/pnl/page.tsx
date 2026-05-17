import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PnlForm from "./pnl-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: snapshots } = await admin
    .from("pnl_snapshots")
    .select("*")
    .order("period", { ascending: false })
    .limit(12);

  // 자동 추정 (이번달) — sales_leads + cost_log
  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: wonThisMonth }, { data: costsThisMonth }] = await Promise.all([
    admin.from("sales_leads").select("estimated_arr_krw, closed_at").eq("stage", "closed_won").gte("closed_at", monthStart),
    admin.from("cost_log").select("service, cost_usd").gte("created_at", monthStart),
  ]);

  const estB2bMonthlyKrw = (wonThisMonth ?? []).reduce((s, l) => s + Math.round(Number(l.estimated_arr_krw ?? 0) / 12), 0);
  const aiCostUsd = (costsThisMonth ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
  const aiCostKrw = Math.round(aiCostUsd * 1350); // USD→KRW 1350 가정

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W31 · 재무 분리</span>
        <h1 className="mt-1 text-3xl font-bold">월간 P&amp;L</h1>
        <p className="mt-1 text-sm text-muted-foreground">ai-studio 사업부 손익 — 본부와 분리 추적.</p>
      </header>

      <section className="mb-8 rounded-lg border-2 border-blue-300 bg-blue-50 p-5">
        <h2 className="mb-3 text-sm font-bold text-blue-900">이번 달 ({period}) 자동 추정</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">B2B 신규 MRR</div>
            <div className="mt-1 font-mono font-bold">₩{(estB2bMonthlyKrw / 1_0000_000).toFixed(1)}M</div>
            <div className="text-[10px] text-muted-foreground">closed_won ARR ÷ 12</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">AI 비용</div>
            <div className="mt-1 font-mono font-bold">₩{(aiCostKrw / 1_0000_000).toFixed(1)}M</div>
            <div className="text-[10px] text-muted-foreground">${aiCostUsd.toFixed(2)} (cost_log)</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">수동 입력 필요</div>
            <div className="mt-1 font-mono">B2C 매출 · 인건비 · 마케팅 · 인프라</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-700">매월 1일에 본부장이 위 자동값 + 외부 항목 확정해서 snapshot 저장.</p>
      </section>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{period} 스냅샷 입력</h2>
        <PnlForm period={period} defaultB2b={estB2bMonthlyKrw} defaultAi={aiCostKrw} />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">최근 12개월 스냅샷</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">기간</th>
                <th className="px-3 py-2 text-right">B2C</th>
                <th className="px-3 py-2 text-right">B2B</th>
                <th className="px-3 py-2 text-right">총 매출</th>
                <th className="px-3 py-2 text-right">AI</th>
                <th className="px-3 py-2 text-right">인건비</th>
                <th className="px-3 py-2 text-right">마케팅</th>
                <th className="px-3 py-2 text-right">총 비용</th>
                <th className="px-3 py-2 text-right">이익</th>
              </tr>
            </thead>
            <tbody>
              {(snapshots ?? []).map((s) => {
                const profit = Number(s.total_revenue_krw) - Number(s.total_cost_krw);
                return (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono">{s.period}</td>
                    <td className="px-3 py-2 text-right font-mono">₩{(Number(s.b2c_revenue_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono">₩{(Number(s.b2b_revenue_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">₩{(Number(s.total_revenue_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">₩{(Number(s.ai_cost_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">₩{(Number(s.personnel_cost_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">₩{(Number(s.marketing_cost_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-red-700">₩{(Number(s.total_cost_krw) / 1_0000_000).toFixed(1)}M</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      ₩{(profit / 1_0000_000).toFixed(1)}M
                    </td>
                  </tr>
                );
              })}
              {(!snapshots || snapshots.length === 0) && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">아직 스냅샷 없음.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
