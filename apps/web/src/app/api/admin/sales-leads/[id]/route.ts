import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGES = new Set(["lead","qualified","demo","proposal","negotiation","closed_won","closed_lost"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.stage && VALID_STAGES.has(body.stage)) {
    update.stage = body.stage;
    if (body.stage === "closed_won" || body.stage === "closed_lost") {
      update.closed_at = new Date().toISOString();
    }
  }
  if (body.next_action) update.next_action = body.next_action.toString().slice(0, 500);
  if (body.notes) update.notes = body.notes.toString().slice(0, 5000);
  const { error } = await supabase.from("sales_leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
