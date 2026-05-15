import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHANNEL = new Set(["naver_search","google_search","kakao_ads","facebook_ads","instagram","influencer","keg_offline","organic","other"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.name || !VALID_CHANNEL.has(body.channel)) {
    return NextResponse.json({ error: "name and valid channel required" }, { status: 400 });
  }
  const { error } = await supabase.from("marketing_campaigns").insert({
    name: body.name.toString().slice(0, 200),
    channel: body.channel,
    budget_krw: Number(body.budget_krw) || 0,
    status: "running",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
