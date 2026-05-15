import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "keg_super_admin", "operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { owner_email, code, reward_krw, discount_pct } = body;
  if (!owner_email || !code) return NextResponse.json({ error: "owner_email and code required" }, { status: 400 });
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return NextResponse.json({ error: "code must be 4-12 uppercase alphanumeric" }, { status: 400 });

  const admin = createAdminClient();

  // owner 찾기
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .eq("email", owner_email)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "owner not found by email" }, { status: 404 });

  const { error } = await admin.from("referral_codes").insert({
    owner_user_id: owner.id,
    code,
    reward_krw: Number(reward_krw) || 30000,
    discount_pct: Number(discount_pct) || 10,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code });
}
