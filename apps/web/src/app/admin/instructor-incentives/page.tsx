import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeMonthlyIncentives } from "@/lib/agents/instructor/compute-incentives";
import CommitButton from "./commit-button";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  basic: "기본",
  excellent: "우수 (+10%)",
  top: "최우수 (+20%)",
  content_ip: "콘텐츠 IP",
};

const TIER_COLOR: Record<string, string> = {
  basic: "bg-zinc-100 text-zinc-700",
  excellent: "bg-blue-100 text-blue-700",
  top: "bg-amber-100 text-amber-700",
  content_ip: "bg-emerald-100 text-emerald-700",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") redirect("/dashboard");

  const { period: pp } = await searchParams;
  const period = pp ?? new Date().toISOString().slice(0, 7);

  const results = await computeMonthlyIncentives(period);
  const totalAmount = results.flatMap((r) => r.incentives).reduce((s, i) => s + i.amount_krw, 0);
  const topCount = results.filter((r) => r.incentives.some((i) => i.tier === "top")).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">강사 인센티브</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            월간 자동 계산 (DRY RUN). 검토 후 [확정 저장]을 누르면 instructor_incentives에 기록됩니다.
          </p>
        </div>
        <form className="flex items-center gap-2" action="/admin/instructor-incentives">
          <label className="text-sm">기간</label>
          <input type="month" name="period" defaultValue={period} className="rounded-md border bg-background px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">조회</button>
        </form>
      </div>

      {results.length === 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          {period} 기간에 instructor 역할 사용자가 없거나 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground">대상 강사</div>
              <div className="text-2xl font-bold">{results.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground">최우수 (top 10%)</div>
              <div className="text-2xl font-bold">{topCount}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground">예상 총 지급액</div>
              <div className="text-2xl font-bold">₩{totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-end">
            <CommitButton period={period} />
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left">강사</th>
                  <th className="px-4 py-2 text-right">AI 활용</th>
                  <th className="px-4 py-2 text-right">학생 NPS</th>
                  <th className="px-4 py-2 text-right">완주율</th>
                  <th className="px-4 py-2 text-right">검토</th>
                  <th className="px-4 py-2 text-right">개입</th>
                  <th className="px-4 py-2 text-right">점수</th>
                  <th className="px-4 py-2 text-left">티어 / 금액</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.instructor.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.instructor.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.instructor.email}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{r.metrics.ai_usage_pct.toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right">{r.metrics.student_nps}</td>
                    <td className="px-4 py-2 text-right">{r.metrics.completion_rate.toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right">{r.metrics.content_review_count}</td>
                    <td className="px-4 py-2 text-right">{r.metrics.risk_intervention_count}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.score.toFixed(1)}</td>
                    <td className="px-4 py-2">
                      {r.incentives.length === 0 ? (
                        <span className="text-xs text-muted-foreground">자격 미달</span>
                      ) : (
                        <div className="space-y-1">
                          {r.incentives.map((inc, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-xs ${TIER_COLOR[inc.tier]}`}>{TIER_LABEL[inc.tier]}</span>
                              <span className="font-mono text-xs">₩{inc.amount_krw.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        AI 활용도: 콘텐츠 검토 1건당 5% (최대 100%). 학생 NPS: 표준 NPS 공식 (promoter 9-10, detractor 0-6).
        완주율: enrollments.status=&apos;completed&apos; / 전체. 점수: 4축 가중 평균 (AI 30·NPS 30·완주 20·케어 20).
      </p>
    </div>
  );
}
