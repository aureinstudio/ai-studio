import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WeeklyReportForm from "./form";

export const dynamic = "force-dynamic";

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export default async function InstructorWeeklyReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/weekly-report");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">강사 또는 관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const week = isoWeek(new Date());
  const { data: existing } = await supabase
    .from("instructor_usage_reports")
    .select("id, used_studio_content, content_count, utility_rating, comments, created_at")
    .eq("instructor_id", user.id)
    .eq("week_iso", week)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">강사 주간 보고</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {week} 주차 · 가설 H3(강사 수용) KPI 측정 입력. 매주 1회 작성.
      </p>
      {existing ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
          <div className="text-emerald-900 font-semibold mb-2">✓ 이번 주 보고 완료</div>
          <p className="text-sm text-emerald-800">
            AI 콘텐츠 활용: {existing.used_studio_content ? "예" : "아니오"}
            {existing.content_count ? ` · ${existing.content_count}건` : ""}
            {existing.utility_rating ? ` · 유용성 ${existing.utility_rating}/5` : ""}
          </p>
        </div>
      ) : (
        <WeeklyReportForm week={week} instructorName={profile?.name ?? null} />
      )}
    </div>
  );
}
