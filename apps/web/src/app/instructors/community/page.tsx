import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewPostForm from "./new-post-form";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  qa: "Q&A",
  best_practice: "베스트 프랙티스",
  announcement: "공지",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructors/community");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!["instructor", "admin", "operations", "sme"].includes(profile?.role ?? "")) redirect("/dashboard");

  const { category } = await searchParams;

  const admin = createAdminClient();
  let q = admin
    .from("instructor_community_posts")
    .select("id, category, title, body, author_id, is_pinned, reply_count, created_at, profiles!instructor_community_posts_author_id_fkey(name)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (category) q = q.eq("category", category);

  const { data: posts } = await q;

  const canPost = profile?.role === "instructor" || profile?.role === "admin";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">강사 커뮤니티</h1>
          <p className="mt-1 text-sm text-muted-foreground">Q&amp;A · 베스트 프랙티스 · 공지</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/instructors/community" className={`rounded-md border px-3 py-1.5 text-xs ${!category ? "bg-foreground text-background" : "hover:bg-muted"}`}>전체</Link>
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
          <Link key={k} href={`/instructors/community?category=${k}`} className={`rounded-md border px-3 py-1.5 text-xs ${category === k ? "bg-foreground text-background" : "hover:bg-muted"}`}>{v}</Link>
        ))}
      </div>

      {canPost && (
        <section className="mb-8 rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">새 글 작성</h2>
          <NewPostForm />
        </section>
      )}

      <div className="rounded-lg border bg-card">
        {(!posts || posts.length === 0) && (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">아직 게시글이 없습니다.</div>
        )}
        <ul className="divide-y">
          {(posts ?? []).map((p) => {
            const author = Array.isArray(p.profiles) ? p.profiles[0] : (p.profiles as { name?: string } | null);
            return (
              <li key={p.id} className="px-6 py-4">
                <div className="flex items-center gap-2 text-xs">
                  {p.is_pinned && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">📌 고정</span>}
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">{CATEGORY_LABEL[p.category] ?? p.category}</span>
                  <span className="text-muted-foreground">{author?.name ?? "익명"} · {new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <h3 className="mt-1 font-medium">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
                <div className="mt-1 text-xs text-muted-foreground">댓글 {p.reply_count}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
