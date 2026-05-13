import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Scenario = {
  key: "conservative" | "moderate" | "aggressive";
  label: string;
  monthly_new_students: number;
  arpu_krw: number;
  cost_per_student_krw: number;
  fixed_cost_monthly_krw: number;
};

const SCENARIOS: Scenario[] = [
  { key: "conservative", label: "보수적", monthly_new_students: 30, arpu_krw: 400_000, cost_per_student_krw: 80_000, fixed_cost_monthly_krw: 30_000_000 },
  { key: "moderate", label: "중간", monthly_new_students: 80, arpu_krw: 500_000, cost_per_student_krw: 90_000, fixed_cost_monthly_krw: 45_000_000 },
  { key: "aggressive", label: "적극적", monthly_new_students: 150, arpu_krw: 550_000, cost_per_student_krw: 100_000, fixed_cost_monthly_krw: 60_000_000 },
];

function project(s: Scenario, months: number) {
  const rows: { m: number; cumulative_students: number; revenue: number; cost: number; profit: number; cumulative_profit: number }[] = [];
  let cumStudents = 0;
  let cumProfit = 0;
  for (let m = 1; m <= months; m++) {
    cumStudents += s.monthly_new_students;
    const revenue = cumStudents * s.arpu_krw;
    const variable = cumStudents * s.cost_per_student_krw;
    const cost = variable + s.fixed_cost_monthly_krw;
    const profit = revenue - cost;
    cumProfit += profit;
    rows.push({ m, cumulative_students: cumStudents, revenue, cost, profit, cumulative_profit: cumProfit });
  }
  return rows;
}

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const projections = SCENARIOS.map((s) => ({
    scenario: s,
    rows: project(s, 24),
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">매출 시뮬레이션 (24개월)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          3-시나리오 비교. 가정값은 페이지 하단의 파라미터 참조. 손익분기는 누적 이익 ≥ 0 시점.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {projections.map(({ scenario, rows }) => {
          const breakEvenMonth = rows.find((r) => r.cumulative_profit >= 0)?.m;
          const m12 = rows[11];
          const m24 = rows[23];
          return (
            <div key={scenario.key} className="rounded-lg border bg-card p-5">
              <h2 className="text-lg font-bold">{scenario.label}</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="손익분기" value={breakEvenMonth ? `${breakEvenMonth}개월` : "24개월 내 미달"} />
                <Row label="12M 매출" value={`₩${(m12.revenue / 1_0000_0000).toFixed(1)}억`} />
                <Row label="12M 누적 이익" value={`₩${(m12.cumulative_profit / 1_0000_0000).toFixed(1)}억`} />
                <Row label="24M 매출" value={`₩${(m24.revenue / 1_0000_0000).toFixed(1)}억`} />
                <Row label="24M 누적 이익" value={`₩${(m24.cumulative_profit / 1_0000_0000).toFixed(1)}억`} />
                <Row label="24M 학생 수" value={`${m24.cumulative_students.toLocaleString()}명`} />
              </dl>
            </div>
          );
        })}
      </div>

      {projections.map(({ scenario, rows }) => (
        <details key={scenario.key} className="mb-4 rounded-lg border bg-card">
          <summary className="cursor-pointer px-6 py-3 font-semibold">월별 상세 — {scenario.label}</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-y bg-muted/50">
                <tr>
                  <th className="px-2 py-1 text-left">월</th>
                  <th className="px-2 py-1 text-right">학생 (누적)</th>
                  <th className="px-2 py-1 text-right">매출</th>
                  <th className="px-2 py-1 text-right">비용</th>
                  <th className="px-2 py-1 text-right">월 이익</th>
                  <th className="px-2 py-1 text-right">누적 이익</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.m} className={`border-b ${r.cumulative_profit >= 0 ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-2 py-1">M{r.m}</td>
                    <td className="px-2 py-1 text-right font-mono">{r.cumulative_students.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right font-mono">₩{(r.revenue / 1_0000_000).toFixed(1)}M</td>
                    <td className="px-2 py-1 text-right font-mono">₩{(r.cost / 1_0000_000).toFixed(1)}M</td>
                    <td className={`px-2 py-1 text-right font-mono ${r.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      ₩{(r.profit / 1_0000_000).toFixed(1)}M
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${r.cumulative_profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      ₩{(r.cumulative_profit / 1_0000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}

      <section className="mt-8 rounded-lg border bg-muted/30 p-6 text-xs">
        <h3 className="mb-2 font-semibold">가정 파라미터</h3>
        <ul className="space-y-1">
          {SCENARIOS.map((s) => (
            <li key={s.key} className="font-mono">
              <b>{s.label}:</b> 월 신규 {s.monthly_new_students}명 · ARPU ₩{s.arpu_krw.toLocaleString()} · 학생당 비용 ₩{s.cost_per_student_krw.toLocaleString()} · 고정비/월 ₩{(s.fixed_cost_monthly_krw / 1_0000_000).toFixed(0)}M
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted-foreground">
          ARPU = 학생 1명 평균 결제 (4개월 평균 가정). 고정비 = 인건비 + 인프라 + 마케팅.
          이탈률·갱신율은 단순화 — 정식 사업계획에서 cohort 분석 필요.
        </p>
      </section>
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
