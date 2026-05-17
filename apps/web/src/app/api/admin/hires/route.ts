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
  if (!body.candidate_name || !body.role) return NextResponse.json({ error: "candidate_name and role required" }, { status: 400 });
  const { error } = await supabase.from("hires").insert({
    candidate_name: body.candidate_name.toString().slice(0, 100),
    role: body.role.toString().slice(0, 50),
    target_department_id: body.target_department_id || null,
    expected_salary_krw: Number(body.expected_salary_krw) || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
