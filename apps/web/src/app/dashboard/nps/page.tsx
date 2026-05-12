import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NpsForm from "./form";

export const dynamic = "force-dynamic";

export default async function NpsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/nps");

  // 이번 주 NPS 이미 응답했는지 확인 (date_trunc('week') unique)
  const weekStart = (() => {
    const d = new Date();
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const { data: existing } = await supabase
    .from("nps_responses")
    .select("id, score, created_at")
    .eq("user_id", user.id)
    .gte("created_at", weekStart)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("learning_prefs")
    .eq("id", user.id)
    .maybeSingle();
  const lang = (profile?.learning_prefs as { language?: string } | null)?.language ?? "ko";
  const segment = lang === "ko" ? "ko" : "multilingual";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">짧은 추천 설문</h1>
      <p className="text-sm text-muted-foreground mb-8">
        ai-studio를 친구·동료에게 추천하시겠습니까? 본부장이 직접 검토합니다.
      </p>
      {existing ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
          <div className="font-semibold text-emerald-900 mb-2">✓ 이번 주 응답 완료 — 감사합니다</div>
          <p className="text-sm text-emerald-800">점수: {existing.score}/10 · 다음 주에 다시 만나요.</p>
        </div>
      ) : (
        <NpsForm segment={segment} />
      )}
    </div>
  );
}
