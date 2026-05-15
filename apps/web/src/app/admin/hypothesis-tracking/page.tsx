import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { measureAll } from "@/lib/kpi/measure";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  H1: { title: "제작 효율", desc: "Studio가 콘텐츠 1건을 5분(300s) 이내에 생성한다." },
  H2: { title: "품질 유지", desc: "SME 평균 평점이 5점 만점 4.0 이상을 유지한다." },
  H3: { title: "강사 수용", desc: "강사 70% 이상이 강의에서 AI 콘텐츠를 활용한다." },
  H4: { title: "다국어 만족도", desc: "다국어 학생 NPS 50 이상." },
  H5: { title: "학습 효과", desc: "주간 자가 진단 만족도 평균 4.0 이상 (베타 단계 대체 지표)." },
};

export default async function HypothesisTrackingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/hypothesis-tracking");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return <Forbidden />;

  const admin = createAdminClient();

  // 실시간 측정 (cron 결과와 별개 — 최신값)
  const live = await measureAll(admin);

  // 7일 추이 — 가설별 시계열
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: history } = await admin
    .from("hypothesis_metrics")
    .select("hypothesis_id, value, passed, measured_at")
    .gte("measured_at", since7d)
    .order("measured_at", { ascending: true });

  const seriesById: Record<string, { v: number; passed: boolean; at: string }[]> = {};
  for (const r of history ?? []) {
    const k = r.hypothesis_id;
    if (!seriesById[k]) seriesById[k] = [];
    if (r.value !== null) seriesById[k].push({ v: Number(r.value), passed: !!r.passed, at: r.measured_at });
  }

  const passedCount = live.filter((r) => r.passed).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">가설 추적</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gate G2 5개 가설 — 매일 자정 자동 측정. 본 페이지는 실시간 재계산.
          </p>
        </div>
        <Link href="/admin/g2-readiness" className="text-sm hover:underline">G2 종합 →</Link>
      </header>

      <Card>
        <CardContent className="p-6">
          <div className="text-xs uppercase text-muted-foreground">종합 통과</div>
          <div className={`mt-2 text-4xl font-bold ${
            passedCount >= 4 ? "text-emerald-600" :
            passedCount >= 2 ? "text-amber-600" : "text-red-600"
          }`}>
            {passedCount} / 5
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            G2 통과 조건: 4/5 이상 + NPS 60+ + SME 합격선
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {live.map((r) => {
          const meta = DESCRIPTIONS[r.hypothesis_id];
          const series = seriesById[r.hypothesis_id] ?? [];
          const max = Math.max(...series.map((s) => s.v), r.value ?? 0, 1);
          return (
            <Card key={r.hypothesis_id}>
              <CardHeader className="px-6 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{r.hypothesis_id}</div>
                    <h2 className="text-lg font-semibold">{meta.title}</h2>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    r.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {r.passed ? "✓ PASS" : "✗ FAIL"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{meta.desc}</p>

                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">현재</div>
                    <div className="text-2xl font-bold font-mono">
                      {r.value === null ? "—" : r.metric_name.includes("ratio") || r.metric_name.includes("rate")
                        ? `${(r.value * 100).toFixed(1)}%`
                        : r.metric_name.includes("nps")
                          ? r.value.toFixed(1)
                          : r.metric_name.includes("duration")
                            ? `${r.value.toFixed(0)}s`
                            : r.value.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">목표</div>
                    <div className="text-sm font-mono">{r.target_label}</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  표본 {r.sample_size}건 · {r.metric_name}
                </div>

                {/* 7일 추이 */}
                {series.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">7일 추이</div>
                    <div className="flex gap-0.5 h-12 items-end">
                      {series.map((s, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${s.passed ? "bg-emerald-500" : "bg-red-400"}`}
                          style={{ height: `${(s.v / max) * 100}%`, minHeight: "2px" }}
                          title={`${new Date(s.at).toLocaleDateString()}: ${s.v.toFixed(2)} ${s.passed ? "✓" : "✗"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Forbidden() {
  return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
}
