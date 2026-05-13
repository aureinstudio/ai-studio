import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { title, body: text, category } = body;
  if (!title?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }
  if (!["qa", "best_practice", "announcement"].includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("instructor_community_posts")
    .insert({
      author_id: user.id,
      title: title.toString().slice(0, 200),
      body: text.toString().slice(0, 10000),
      category,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
