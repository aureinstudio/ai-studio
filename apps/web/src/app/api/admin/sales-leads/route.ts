import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.company_name) return NextResponse.json({ error: "company_name required" }, { status: 400 });
  const { error } = await supabase.from("sales_leads").insert({
    company_name: body.company_name.toString().slice(0, 200),
    contact_name: body.contact_name?.toString().slice(0, 100) ?? null,
    contact_email: body.contact_email?.toString().slice(0, 200) ?? null,
    estimated_arr_krw: Number(body.estimated_arr_krw) || null,
    owner_user_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
