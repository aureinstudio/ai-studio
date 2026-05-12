import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import ReviewForm from "./review-form";

export const dynamic = "force-dynamic";

export default async function SmeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/sme/dashboard");
  const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "sme" && profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, topic, level, length, content, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  // 기존 본인 평가
  const { data: existing } = await admin
    .from("sme_evaluations")
    .select("id, accuracy_score, suitability_score, exam_alignment_score, improvements")
    .eq("studio_job_id", id)
    .eq("evaluator_id", user.id)
    .maybeSingle();

  // 콘텐츠 슬라이드 1개 미리보기
  type Content = { planner?: { slides?: { title?: string; content_blocks?: string[] }[] } };
  const content = (job.content ?? {}) as Content;
  const slides = content.planner?.slides ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/sme/dashboard" className="text-xs text-muted-foreground hover:underline">← SME 대시보드</Link>
          <h1 className="text-2xl font-bold mt-1">{job.topic}</h1>
          <p className="text-sm text-muted-foreground">
            {job.level} · {job.length} · 생성 {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>
      </header>

      {/* 콘텐츠 미리보기 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">콘텐츠 미리보기 ({slides.length} 슬라이드)</h2>
          {slides.length === 0 ? (
            <p className="text-sm text-muted-foreground">슬라이드 데이터 없음.</p>
          ) : (
            <div className="space-y-4">
              {slides.slice(0, 5).map((s, i) => (
                <div key={i} className="border rounded p-4">
                  <div className="text-xs text-muted-foreground mb-1">슬라이드 {i + 1}</div>
                  <div className="font-semibold mb-2">{s.title}</div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {(s.content_blocks ?? []).slice(0, 5).map((b, j) => (
                      <li key={j}>• {b}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {slides.length > 5 && (
                <p className="text-xs text-muted-foreground">… {slides.length - 5}개 더</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ReviewForm
        studioJobId={id}
        initial={existing ? {
          accuracy: existing.accuracy_score ?? 0,
          suitability: existing.suitability_score ?? 0,
          exam: existing.exam_alignment_score ?? 0,
          improvements: existing.improvements ?? "",
        } : null}
      />
    </div>
  );
}
