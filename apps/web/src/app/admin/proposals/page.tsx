import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReviewActions from "./review-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  sme_review: "검토 중",
  approved: "승인",
  rejected: "반려",
  published: "공개",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "sme"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: proposals } = await admin
    .from("instructor_content_proposals")
    .select("id, title, course_category, topic, outline, status, created_at, instructor_id, profiles!instructor_content_proposals_instructor_id_fkey(name, email)")
    .in("status", ["pending", "sme_review"])
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold">콘텐츠 제안 검토 큐</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        강사가 제안한 신규 콘텐츠를 SME가 검토하고 승인/반려합니다.
        승인 시 강사에게 보너스 ₩500,000 자동 지급 대상으로 등록됩니다.
      </p>

      {(!proposals || proposals.length === 0) ? (
        <div className="mt-8 rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          검토 대기 중인 제안이 없습니다.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {proposals.map((p) => {
            const author = Array.isArray(p.profiles) ? p.profiles[0] : (p.profiles as { name?: string; email?: string } | null);
            return (
              <div key={p.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">{STATUS_LABEL[p.status]}</span>
                  <span className="text-muted-foreground">{p.course_category}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{author?.name ?? author?.email ?? "익명"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm">{p.topic}</p>
                {p.outline && (
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs">{p.outline}</pre>
                )}
                <ReviewActions id={p.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
