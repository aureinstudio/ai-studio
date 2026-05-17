import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHANNEL = new Set(["blog","youtube","instagram","linkedin","x","newsletter"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.title || !VALID_CHANNEL.has(body.channel)) {
    return NextResponse.json({ error: "title and valid channel required" }, { status: 400 });
  }
  const { error } = await supabase.from("content_pieces").insert({
    channel: body.channel,
    title: body.title.toString().slice(0, 200),
    scheduled_date: body.scheduled_date || null,
    category: body.category ?? null,
    url: body.url?.toString().slice(0, 500) ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
