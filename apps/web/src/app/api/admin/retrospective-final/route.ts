import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "operations", "sme", "instructor", "creator"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { went_well, was_hard, do_differently, advice_for_successors } = body;

  const { error } = await supabase.from("retrospective_final").insert({
    author_id: user.id,
    went_well: Array.isArray(went_well) ? went_well.slice(0, 10).map((s: string) => s.toString().slice(0, 500)) : [],
    was_hard: Array.isArray(was_hard) ? was_hard.slice(0, 10).map((s: string) => s.toString().slice(0, 500)) : [],
    do_differently: Array.isArray(do_differently) ? do_differently.slice(0, 10).map((s: string) => s.toString().slice(0, 500)) : [],
    advice_for_successors: advice_for_successors?.toString().slice(0, 5000) ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
