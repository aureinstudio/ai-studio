import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["pass_to_phase4c", "reinforce_2w", "fail"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["keg_super_admin", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { decision, rationale, next_actions, gates } = body;
  if (!VALID.has(decision)) return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  if (!rationale?.trim()) return NextResponse.json({ error: "rationale required" }, { status: 400 });

  const { data, error } = await supabase
    .from("g4b_decisions")
    .insert({
      decision,
      rationale: rationale.toString().slice(0, 5000),
      next_actions: next_actions?.toString().slice(0, 10000) ?? null,
      decided_by: user.id,
      metadata: { gates },
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 스냅샷도 함께 저장
  await supabase.from("g4b_reports").insert({
    generated_by: user.id,
    gate_status: decision === "pass_to_phase4c" ? "pass" : decision === "reinforce_2w" ? "partial" : "fail",
    raw_payload: { gates, rationale },
  });

  return NextResponse.json({ ok: true, decision_id: data.id });
}
