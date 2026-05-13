import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ChoiceForm from "./choice-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/beta-end-data");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("beta_end_data_choices")
    .select("choice, applied_at, created_at")
    .eq("student_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">베타 종료 — 내 데이터 처리 선택</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ai-studio 베타 기간이 종료됩니다. 본인의 학습 데이터를 어떻게 처리할지 선택해주세요.
        선택은 1회 가능하며, 정식 서비스 출시 시 안내됩니다.
      </p>

      {existing ? (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <div className="font-semibold">현재 선택: {labelFor(existing.choice)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            선택일: {new Date(existing.created_at).toLocaleString("ko-KR")}
            {existing.applied_at && ` · 처리 완료: ${new Date(existing.applied_at).toLocaleString("ko-KR")}`}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <ChoiceForm />
        </div>
      )}

      <section className="mt-8 rounded-lg border bg-muted/30 p-4 text-xs">
        <h3 className="mb-2 font-semibold">옵션 설명</h3>
        <ul className="space-y-2">
          <li><b>정식 서비스 전환 (50% 할인):</b> 학습 데이터·진척이 그대로 유지되며 정식 서비스 출시 시 자동 가입. 첫 6개월 50% 할인.</li>
          <li><b>익명화만 유지:</b> 본인 이메일/이름은 즉시 삭제. 학습 통계는 익명으로 KEG 학술·B2B 자료에 활용 가능 (재식별 불가).</li>
          <li><b>완전 삭제:</b> 모든 데이터 영구 삭제. 1개월 유예 기간 후 자동 처리.</li>
        </ul>
      </section>
    </div>
  );
}

function labelFor(c: string): string {
  return { convert_paid: "정식 전환 (50% 할인)", anonymize_only: "익명화만 유지", delete_all: "완전 삭제" }[c] ?? c;
}
