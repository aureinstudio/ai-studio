import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_OPTIONS } from "@/lib/agents/studio/adapters";
import EnrollButton from "./enroll-button";

export const dynamic = "force-dynamic";

type Course = {
  id: string;
  topic: string;
  course_category: string;
  level: string;
  length: string;
  is_sample: boolean;
  user_id: string;
  created_at: string;
};

export default async function CoursesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/courses");

  const params = await searchParams;
  const admin = createAdminClient();

  // 공개 sample + 본인 콘텐츠 (completed 상태만)
  let courseQuery = admin
    .from("studio_jobs")
    .select("id, topic, course_category, level, length, is_sample, user_id, created_at")
    .eq("status", "completed")
    .is("deleted_at", null)
    .or(`is_sample.eq.true,user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (params.category) {
    courseQuery = courseQuery.eq("course_category", params.category);
  }
  const { data: courses } = await courseQuery;

  // 현재 본인 등록 목록
  const { data: enrollments } = await admin
    .from("student_enrollments")
    .select("studio_job_id, status")
    .eq("student_id", user.id);
  const enrolledIds = new Set((enrollments ?? []).map((e) => e.studio_job_id));
  const droppedIds = new Set(
    (enrollments ?? []).filter((e) => e.status === "dropped").map((e) => e.studio_job_id),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">과정 카탈로그</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            관심 있는 과정에 수강 신청. 진도는 [대시보드](/dashboard)에서 확인.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm hover:underline">← 대시보드</Link>
      </header>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/courses"
          className={`px-3 py-1.5 rounded text-sm ${!params.category ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}
        >
          전체
        </Link>
        {CATEGORY_OPTIONS.map((c) => (
          <Link
            key={c.value}
            href={`/courses?category=${c.value}`}
            className={`px-3 py-1.5 rounded text-sm ${
              params.category === c.value ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* 카드 그리드 */}
      {(courses ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            {params.category ? "이 카테고리에 완료된 과정이 없습니다." : "공개된 과정이 아직 없습니다."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(courses as Course[]).map((c) => {
            const enrolled = enrolledIds.has(c.id);
            const wasDropped = droppedIds.has(c.id);
            const catLabel =
              CATEGORY_OPTIONS.find((o) => o.value === c.course_category)?.label ?? c.course_category;
            return (
              <Card key={c.id} className={enrolled && !wasDropped ? "border-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/20" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted">{catLabel}</span>
                    {c.is_sample && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">샘플</span>
                    )}
                    {c.user_id === user.id && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">내 콘텐츠</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold leading-tight">{c.topic}</h3>
                  <div className="text-xs text-muted-foreground">
                    {LEVEL_LABEL[c.level] ?? c.level} · {LENGTH_LABEL[c.length] ?? c.length}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <EnrollButton
                      studioJobId={c.id}
                      initialEnrolled={enrolled && !wasDropped}
                    />
                    <Link
                      href={`/learn/${c.id}`}
                      className="px-3 py-1.5 text-xs rounded border hover:bg-muted"
                    >
                      학습 →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};
const LENGTH_LABEL: Record<string, string> = {
  short: "짧음",
  medium: "보통",
  long: "긴 분량",
};
