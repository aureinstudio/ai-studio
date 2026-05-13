import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORY = new Set(["certification", "professional", "language", "hobby", "academic"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { title, topic, outline, course_category } = body;
  if (!title?.trim() || !topic?.trim()) {
    return NextResponse.json({ error: "title and topic required" }, { status: 400 });
  }
  if (!VALID_CATEGORY.has(course_category)) {
    return NextResponse.json({ error: "invalid course_category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("instructor_content_proposals")
    .insert({
      instructor_id: user.id,
      title: title.toString().slice(0, 200),
      topic: topic.toString().slice(0, 500),
      outline: outline?.toString().slice(0, 5000) ?? null,
      course_category,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
