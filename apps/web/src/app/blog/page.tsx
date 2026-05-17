import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog · ai-studio" };

const CATEGORY_LABEL: Record<string, string> = {
  "how-to": "How-to",
  "case-study": "Case Study",
  "industry": "Industry",
  "announcement": "Announcement",
};

export default async function Page() {
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, category, published_at, view_count")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold">ai-studio Blog</h1>
        <p className="mt-3 text-lg text-muted-foreground">교육 AX · AI로 교재 만드는 법 · 고객 성공 사례</p>
      </header>

      {(posts?.length ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-20 text-center text-muted-foreground">
          첫 글이 곧 발행됩니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(posts ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group block rounded-lg border bg-card overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              {p.cover_image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.cover_image_url} alt="" className="h-48 w-full object-cover" />
              ) : (
                <div className="h-48 bg-gradient-to-br from-zinc-100 to-zinc-200" />
              )}
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2 text-xs">
                  {p.category && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">
                      {CATEGORY_LABEL[p.category] ?? p.category}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {p.published_at && new Date(p.published_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <h2 className="text-xl font-bold group-hover:text-blue-600">{p.title}</h2>
                {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
