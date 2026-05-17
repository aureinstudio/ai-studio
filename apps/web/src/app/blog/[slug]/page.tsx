import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("title, excerpt, body_md, cover_image_url, category, published_at, view_count, author_id, profiles!blog_posts_author_id_fkey(name)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) notFound();

  // 조회수 증가 (fire & forget)
  void admin.from("blog_posts").update({ view_count: (post.view_count ?? 0) + 1 }).eq("slug", slug).then(() => null, () => null);

  const author = Array.isArray(post.profiles) ? post.profiles[0] : (post.profiles as { name?: string } | null);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/blog" className="text-sm text-blue-600 hover:underline">← Blog</Link>

      {post.cover_image_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={post.cover_image_url} alt="" className="mt-4 mb-6 w-full rounded-lg object-cover" />
      )}

      <div className="mb-2 flex items-center gap-2 text-xs">
        {post.category && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">{post.category}</span>}
        <span className="text-muted-foreground">
          {author?.name ?? "ai-studio"} · {post.published_at && new Date(post.published_at).toLocaleDateString("ko-KR")}
        </span>
      </div>

      <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
      {post.excerpt && <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>}

      <div className="prose prose-zinc mt-8 max-w-none">
        <MarkdownRenderer source={post.body_md} />
      </div>
    </article>
  );
}

/**
 * 간이 markdown 렌더러 — 외부 의존성 없이 핵심 마크다운만 처리.
 * (운영자 직접 작성 글이라 XSS 위험 낮음. 추후 react-markdown 도입 권장.)
 */
function MarkdownRenderer({ source }: { source: string }) {
  const lines = source.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBuf: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (codeBuf) {
        elements.push(<pre key={i} className="overflow-x-auto rounded bg-zinc-900 p-4 text-xs text-zinc-100"><code>{codeBuf.join("\n")}</code></pre>);
        codeBuf = null;
      } else {
        codeBuf = [];
      }
      continue;
    }
    if (codeBuf !== null) { codeBuf.push(line); continue; }
    if (line.startsWith("# ")) elements.push(<h1 key={i} className="mt-8 text-3xl font-bold">{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) elements.push(<h2 key={i} className="mt-6 text-2xl font-bold">{line.slice(3)}</h2>);
    else if (line.startsWith("### ")) elements.push(<h3 key={i} className="mt-4 text-xl font-bold">{line.slice(4)}</h3>);
    else if (line.startsWith("- ")) elements.push(<li key={i} className="ml-6 list-disc">{line.slice(2)}</li>);
    else if (line.trim() === "") elements.push(<div key={i} className="h-3" />);
    else elements.push(<p key={i} className="my-3">{line}</p>);
  }
  return <>{elements}</>;
}
