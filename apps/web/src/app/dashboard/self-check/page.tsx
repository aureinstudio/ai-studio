import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SelfCheckForm from "./form";

export const dynamic = "force-dynamic";

function isoWeek(d: Date): string {
  // ISO 8601 — Mon = 1
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export default async function SelfCheckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/self-check");

  const week = isoWeek(new Date());
  const { data: existing } = await supabase
    .from("student_feedback")
    .select("id, satisfaction, hardest_part, tutor_helpful, comments, created_at")
    .eq("user_id", user.id)
    .eq("week_iso", week)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">이번 주 자가 진단</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {week} 주차 · 주 1회 작성. 본부장이 직접 검토합니다.
      </p>
      {existing ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
          <div className="text-emerald-900 font-semibold mb-2">✓ 이번 주 자가 진단 완료</div>
          <p className="text-sm text-emerald-800">
            제출일 {new Date(existing.created_at).toLocaleDateString()} · 다음 주에 다시 만나요.
          </p>
        </div>
      ) : (
        <SelfCheckForm week={week} />
      )}
    </div>
  );
}
