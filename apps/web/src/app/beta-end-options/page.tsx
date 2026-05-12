import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BetaEndForm from "./form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "베타 종료 안내 — KEG AI Studio",
};

export default async function BetaEndOptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/beta-end-options");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();
  const { data: existing } = await supabase
    .from("beta_end_choices")
    .select("choice, chosen_at, note")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">베타 종료 안내 — 데이터 처리 선택</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {profile?.name ?? "학습자"}님, 4주 베타가 곧 종료됩니다. 본인의 학습 데이터를 어떻게 처리할지 선택해 주세요.
        선택은 언제든 변경 가능합니다.
      </p>

      {existing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-6">
          <p className="text-sm text-emerald-900">
            ✓ 현재 선택: <strong>{labelOf(existing.choice)}</strong>
            <span className="text-xs ml-2">({new Date(existing.chosen_at).toLocaleDateString()})</span>
          </p>
          {existing.note && <p className="text-xs text-emerald-800 mt-2">메모: {existing.note}</p>}
          <p className="text-xs text-emerald-800 mt-2">아래에서 변경할 수 있습니다.</p>
        </div>
      )}

      <BetaEndForm currentChoice={existing?.choice ?? null} />
    </div>
  );
}

function labelOf(choice: string): string {
  switch (choice) {
    case "continue_full": return "정식 서비스 전환 (계정·데이터 유지)";
    case "delete_all": return "데이터 완전 삭제";
    case "anonymous_stats_only": return "익명 통계로만 유지";
    default: return choice;
  }
}
