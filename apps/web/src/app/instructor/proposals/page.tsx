import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProposalForm from "./proposal-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "검토 대기",
  sme_review: "SME 검토 중",
  approved: "승인됨 ✓",
  rejected: "반려됨",
  published: "공개됨 🚀",
};

const STATUS_CLS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  sme_review: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  published: "bg-purple-100 text-purple-700",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/proposals");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: proposals } = await admin
    .from("instructor_content_proposals")
    .select("id, title, course_category, topic, status, created_at, reviewed_at, feedback")
    .eq("instructor_id", user.id)
    .order("created_at", { ascending: false });

  const approved = (proposals ?? []).filter((p) => p.status === "approved" || p.status === "published").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">콘텐츠 제안</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          직접 가르치는 영역의 신규 콘텐츠를 제안하세요. SME 검토 후 학생에게 공개되며,
          채택 시 <b>1회 보너스 (₩500,000)</b> + <b>&quot;Contributed by [이름]&quot; 영구 크레딧</b>이 부여됩니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          채택 누적: <b>{approved}건</b> · 본인 KPI에 자동 반영
        </p>
      </div>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">새 제안</h2>
        <ProposalForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3">
          <h2 className="font-semibold">내 제안 ({proposals?.length ?? 0})</h2>
        </div>
        {(!proposals || proposals.length === 0) ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">아직 제안한 콘텐츠가 없습니다.</div>
        ) : (
          <ul className="divide-y">
            {proposals.map((p) => (
              <li key={p.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[p.status]}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                  <span className="text-xs text-muted-foreground">{p.course_category}</span>
                </div>
                <h3 className="mt-1 font-medium">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.topic}</p>
                {p.feedback && (
                  <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                    <b>피드백:</b> {p.feedback}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  제안 {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  {p.reviewed_at && ` · 검토 ${new Date(p.reviewed_at).toLocaleDateString("ko-KR")}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        IP 정책: 강사가 만든 콘텐츠는 KEG 공동 자산이며 동시에 본인 크레딧이 영구 표기됩니다.
        강사 이직 시 본인 콘텐츠 활용 권리는 별도 계약으로 보장됩니다.
      </p>
    </div>
  );
}
