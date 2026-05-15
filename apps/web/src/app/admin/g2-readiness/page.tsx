import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { measureAll, measureOverallNps } from "@/lib/kpi/measure";

export const dynamic = "force-dynamic";

export default async function G2ReadinessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/g2-readiness");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();

  const [hypos, nps30] = await Promise.all([
    measureAll(admin),
    measureOverallNps(admin, 30),
  ]);

  const passedHypos = hypos.filter((h) => h.passed).length;

  // SME 합격선: 4.0 / 5 = 80% — sme_evaluations 평균 ≥ 4.0 비율
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: smeEvals } = await admin
    .from("sme_evaluations")
    .select("rating, accuracy_score, suitability_score, exam_alignment_score, studio_job_id")
    .gte("created_at", since30d);
  type Eval = { rating: number | null; accuracy_score: number | null; suitability_score: number | null; exam_alignment_score: number | null; studio_job_id: string };
  const byJob: Record<string, number[]> = {};
  for (const e of (smeEvals ?? []) as Eval[]) {
    const triple = [e.accuracy_score, e.suitability_score, e.exam_alignment_score].map(Number).filter((n) => n >= 1);
    const score = triple.length === 3 ? triple.reduce((s, n) => s + n, 0) / 3 : Number(e.rating ?? 0);
    if (score > 0) {
      if (!byJob[e.studio_job_id]) byJob[e.studio_job_id] = [];
      byJob[e.studio_job_id].push(score);
    }
  }
  const jobScores = Object.values(byJob).map((arr) => arr.reduce((s, n) => s + n, 0) / arr.length);
  const passingJobs = jobScores.filter((s) => s >= 4.0).length;
  const smePassRate = jobScores.length > 0 ? (passingJobs / jobScores.length) * 100 : null;

  // 강사 활용률 — H3 같은 metric 재사용
  const h3 = hypos.find((h) => h.hypothesis_id === "H3")!;
  const instructorRate = h3.value !== null ? h3.value * 100 : null;

  // Gate G2 조건
  const checks = [
    {
      key: "hypos",
      label: "5개 가설 중 4개 이상 통과",
      pass: passedHypos >= 4,
      detail: `${passedHypos} / 5 통과`,
    },
    {
      key: "nps",
      label: "NPS 60 이상",
      pass: nps30.nps !== null && nps30.nps >= 60,
      detail: nps30.nps !== null ? `NPS ${nps30.nps.toFixed(1)} (n=${nps30.sample_size})` : "표본 부족",
    },
    {
      key: "sme",
      label: "SME 합격선 85% 이상",
      pass: smePassRate !== null && smePassRate >= 85,
      detail: smePassRate !== null ? `${smePassRate.toFixed(1)}% (${passingJobs}/${jobScores.length})` : "평가 부족",
    },
    {
      key: "instructor",
      label: "강사 활용률 70% 이상",
      pass: instructorRate !== null && instructorRate >= 70,
      detail: instructorRate !== null ? `${instructorRate.toFixed(1)}% (n=${h3.sample_size})` : "보고 부족",
    },
  ];
  const passedCount = checks.filter((c) => c.pass).length;
  const overallPct = (passedCount / checks.length) * 100;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gate G2 통과 준비</h1>
          <p className="mt-1 text-sm text-muted-foreground">베타 → 정식 출시 의사결정용 종합 KPI</p>
        </div>
        <Link href="/admin/hypothesis-tracking" className="text-sm hover:underline">가설 상세 →</Link>
      </header>

      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-xs uppercase text-muted-foreground">G2 진척률</div>
          <div className={`mt-2 text-5xl font-bold ${
            overallPct >= 100 ? "text-emerald-600" :
            overallPct >= 75 ? "text-blue-600" :
            overallPct >= 50 ? "text-amber-600" : "text-red-600"
          }`}>
            {Math.round(overallPct)}%
          </div>
          <div className="mt-2 text-sm">
            {passedCount} / {checks.length} 조건 충족
            {overallPct >= 100 ? " — 🎉 G2 통과 준비 완료" : ""}
          </div>
          <div className="mt-4 h-3 bg-muted rounded overflow-hidden">
            <div
              className={`h-full ${
                overallPct >= 100 ? "bg-emerald-500" :
                overallPct >= 75 ? "bg-blue-500" :
                overallPct >= 50 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">조건별 현황</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <ul className="divide-y">
            {checks.map((c) => (
              <li key={c.key} className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className={`mt-0.5 text-lg ${c.pass ? "text-emerald-600" : "text-red-600"}`}>
                    {c.pass ? "✓" : "✗"}
                  </span>
                  <div>
                    <div className="font-semibold text-sm">{c.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{c.detail}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                  c.pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}>
                  {c.pass ? "PASS" : "FAIL"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* NPS 세부 */}
      {nps30.sample_size > 0 && (
        <Card>
          <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">NPS 분포 (30일)</h2></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">NPS</div>
                <div className="text-2xl font-bold">{nps30.nps?.toFixed(1) ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Promoter (9-10)</div>
                <div className="text-2xl font-bold text-emerald-600">{nps30.promoters}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Passive (7-8)</div>
                <div className="text-2xl font-bold text-zinc-500">{nps30.passives}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Detractor (0-6)</div>
                <div className="text-2xl font-bold text-red-600">{nps30.detractors}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
