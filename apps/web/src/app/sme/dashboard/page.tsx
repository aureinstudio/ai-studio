import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SmeDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/sme/dashboard");
  const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "sme" && profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">SME 또는 관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();

  // 검토 대기 — 최근 30일 completed jobs 중 본인이 평가하지 않은 것
  const { data: allJobs } = await admin
    .from("studio_jobs")
    .select("id, topic, created_at")
    .eq("status", "completed")
    .gte("created_at", since30d)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: myEvals } = await admin
    .from("sme_evaluations")
    .select("studio_job_id, created_at, rating, accuracy_score, suitability_score, exam_alignment_score, improvements")
    .eq("evaluator_id", user.id);
  const reviewedSet = new Set((myEvals ?? []).map((e) => e.studio_job_id));

  const pending = (allJobs ?? []).filter((j) => !reviewedSet.has(j.id));
  const myReviewed = (allJobs ?? []).filter((j) => reviewedSet.has(j.id));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SME 검토 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.name ?? "SME"}님 환영합니다 · 검토 대기 {pending.length}건
          </p>
        </div>
      </header>

      {/* 가이드라인 */}
      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">평가 가이드라인</h2></CardHeader>
        <CardContent className="px-6 pb-6 text-sm leading-relaxed space-y-2">
          <p><strong>3축 평가 (각 1-5점)</strong>:</p>
          <ul className="list-disc pl-6 text-muted-foreground">
            <li><strong>정확성</strong>: 사실 오류·왜곡 없는가</li>
            <li><strong>학습자 적합성</strong>: 대상 수준에 맞는 표현·예시인가</li>
            <li><strong>시험 출제 경향 부합도</strong>: 실제 자격증 시험 출제 범위·난이도와 일치하는가</li>
          </ul>
          <p className="text-xs">합격선 4.0/5 이상 — 미달 시 자동 보완 워크플로우 트리거</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">검토 대기 ({pending.length}건)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">대기 항목 없음. 👍</p>
          ) : (
            <ul className="divide-y">
              {pending.map((j) => (
                <li key={j.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{j.topic}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {new Date(j.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Link
                    href={`/sme/review/${j.id}`}
                    className="px-4 py-1.5 text-sm rounded bg-foreground text-background hover:opacity-90"
                  >
                    검토 →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">내 검토 이력 (최근 30일, {myReviewed.length}건)</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {myReviewed.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 검토 없음.</p>
          ) : (
            <ul className="divide-y">
              {myReviewed.slice(0, 20).map((j) => {
                const ev = (myEvals ?? []).find((e) => e.studio_job_id === j.id);
                const triple = [ev?.accuracy_score, ev?.suitability_score, ev?.exam_alignment_score]
                  .map(Number).filter((n) => n >= 1);
                const avg = triple.length === 3 ? (triple.reduce((s, n) => s + n, 0) / 3) : Number(ev?.rating ?? 0);
                return (
                  <li key={j.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{j.topic}</div>
                      <div className="text-xs text-muted-foreground">
                        평균 {avg.toFixed(1)}/5 · {ev?.created_at ? new Date(ev.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <Link href={`/sme/review/${j.id}`} className="text-sm text-muted-foreground hover:underline">
                      재검토
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
