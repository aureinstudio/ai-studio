import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["go","hold","pivot_b2c","pivot_b2b","stop"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["keg_super_admin","admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!VALID.has(body.decision)) return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  if (!body.rationale?.trim()) return NextResponse.json({ error: "rationale required" }, { status: 400 });

  const { error } = await supabase.from("g4c_decisions").insert({
    decision: body.decision,
    rationale: body.rationale.toString().slice(0, 5000),
    next_actions: body.next_actions?.toString().slice(0, 10000) ?? null,
    board_meeting_date: body.board_meeting_date || null,
    spinoff_consideration: !!body.spinoff_consideration,
    decided_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
