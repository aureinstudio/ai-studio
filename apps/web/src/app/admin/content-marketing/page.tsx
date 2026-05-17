import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewPostForm from "./new-post-form";
import NewPieceForm from "./new-piece-form";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  blog: "Blog", youtube: "YouTube", instagram: "Instagram",
  linkedin: "LinkedIn", x: "X (Twitter)", newsletter: "Newsletter",
};

const STATUS_CLS: Record<string, string> = {
  planned: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-blue-100 text-blue-700",
  published: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: posts }, { data: pieces }] = await Promise.all([
    admin.from("blog_posts").select("id, slug, title, status, category, published_at, view_count, author_id").order("created_at", { ascending: false }).limit(30),
    admin.from("content_pieces").select("*").order("scheduled_date", { ascending: false }).limit(50),
  ]);

  // 주간 발행 계산
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const blogPublished = (posts ?? []).filter((p) => p.status === "published" && p.published_at && new Date(p.published_at) >= since30).length;
  const ytPublished = (pieces ?? []).filter((p) => p.channel === "youtube" && p.status === "published" && p.published_date && new Date(p.published_date) >= since30).length;
  const blogWeekly = (blogPublished / 4.3).toFixed(1);
  const ytWeekly = (ytPublished / 4.3).toFixed(1);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W33 · CONTENT</span>
        <h1 className="mt-1 text-3xl font-bold">콘텐츠 마케팅</h1>
        <p className="mt-1 text-sm text-muted-foreground">블로그 주 2회 · 유튜브 주 1회 · 통합 캘린더.</p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="블로그 30일 발행" value={blogPublished.toString()} sub={`주당 ${blogWeekly}회 / 목표 2`} hit={Number(blogWeekly) >= 2} />
        <Stat label="YouTube 30일" value={ytPublished.toString()} sub={`주당 ${ytWeekly}회 / 목표 1`} hit={Number(ytWeekly) >= 1} />
        <Stat label="블로그 누적" value={(posts ?? []).filter((p) => p.status === "published").length.toString()} />
        <Stat label="콘텐츠 캘린더" value={(pieces ?? []).filter((p) => p.status === "planned" || p.status === "in_progress").length.toString()} sub="진행 중" />
      </div>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 블로그 글</h2>
        <NewPostForm />
      </section>

      <section className="mb-8 rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">블로그 글 ({posts?.length ?? 0})</h2></div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">카테고리</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-right">조회</th>
              <th className="px-3 py-2 text-left">발행</th>
            </tr>
          </thead>
          <tbody>
            {(posts ?? []).map((p) => (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="px-3 py-2"><Link href={`/blog/${p.slug}`} target="_blank" className="font-medium hover:underline">{p.title}</Link></td>
                <td className="px-3 py-2 text-xs">{p.category ?? "—"}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLS[p.status] ?? "bg-zinc-100"}`}>{p.status}</span></td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.view_count}</td>
                <td className="px-3 py-2 text-xs">{p.published_at ? new Date(p.published_at).toLocaleDateString("ko-KR") : "—"}</td>
              </tr>
            ))}
            {(!posts || posts.length === 0) && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">아직 글 없음.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">통합 콘텐츠 캘린더 (블로그·YouTube·소셜)</h2>
        <NewPieceForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">캘린더 ({pieces?.length ?? 0})</h2></div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">채널</th>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">예정/발행일</th>
              <th className="px-3 py-2 text-right">조회</th>
            </tr>
          </thead>
          <tbody>
            {(pieces ?? []).map((p) => (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-xs font-semibold">{CHANNEL_LABEL[p.channel] ?? p.channel}</td>
                <td className="px-3 py-2">{p.url ? <a href={p.url} target="_blank" rel="noopener" className="hover:underline">{p.title}</a> : p.title}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLS[p.status]}`}>{p.status}</span></td>
                <td className="px-3 py-2 text-xs">{p.published_date ?? p.scheduled_date ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.views ?? "—"}</td>
              </tr>
            ))}
            {(!pieces || pieces.length === 0) && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">아직 항목 없음.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, hit }: { label: string; value: string; sub?: string; hit?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${hit === true ? "text-emerald-600" : hit === false ? "text-amber-600" : ""}`}>
        {value} {hit === true && "✓"}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
