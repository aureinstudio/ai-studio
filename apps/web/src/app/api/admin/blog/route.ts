import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORY = new Set(["how-to", "case-study", "industry", "announcement"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations","creator"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.title || !body.slug || !body.body_md) {
    return NextResponse.json({ error: "title, slug, body_md required" }, { status: 400 });
  }
  if (!/^[a-z0-9가-힣-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (body.category && !VALID_CATEGORY.has(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  const status = body.status === "published" ? "published" : "draft";
  const { error } = await supabase.from("blog_posts").insert({
    title: body.title.toString().slice(0, 200),
    slug: body.slug.toString().slice(0, 80),
    excerpt: body.excerpt?.toString().slice(0, 500) ?? null,
    body_md: body.body_md.toString().slice(0, 50000),
    category: body.category ?? null,
    author_id: user.id,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
