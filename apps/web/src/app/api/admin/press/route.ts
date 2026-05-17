import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPE = new Set(["press_release","interview","article","conference_talk","podcast","case_study"]);
const VALID_SENT = new Set(["positive","neutral","negative"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.outlet || !body.title || !VALID_TYPE.has(body.mention_type)) {
    return NextResponse.json({ error: "outlet, title, valid mention_type required" }, { status: 400 });
  }
  const { error } = await supabase.from("press_mentions").insert({
    mention_type: body.mention_type,
    outlet: body.outlet.toString().slice(0, 100),
    title: body.title.toString().slice(0, 300),
    url: body.url?.toString().slice(0, 500) ?? null,
    published_date: body.published_date || null,
    reach_estimate: Number(body.reach_estimate) || null,
    sentiment: VALID_SENT.has(body.sentiment) ? body.sentiment : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
