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
  if (!body.customer_name || !body.headline) {
    return NextResponse.json({ error: "customer_name and headline required" }, { status: 400 });
  }
  const { error } = await supabase.from("case_studies").insert({
    customer_name: body.customer_name.toString().slice(0, 200),
    industry: body.industry?.toString().slice(0, 100) ?? null,
    headline: body.headline.toString().slice(0, 200),
    problem: body.problem?.toString().slice(0, 2000) ?? null,
    solution: body.solution?.toString().slice(0, 2000) ?? null,
    testimonial: body.testimonial?.toString().slice(0, 2000) ?? null,
    testimonial_author: body.testimonial_author?.toString().slice(0, 100) ?? null,
    published: !!body.published,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
