import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["m1_understand", "m2_studio", "m3_tutor", "m4_care", "m5_review"]);

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }), supabase: null, user: null };
  return { error: null, supabase, user };
}

export async function POST(request: NextRequest) {
  const { error, supabase, user } = await auth();
  if (error) return error;
  const { module_key } = await request.json().catch(() => ({}));
  if (!VALID.has(module_key)) return NextResponse.json({ error: "invalid module_key" }, { status: 400 });

  const { error: dbErr } = await supabase!
    .from("instructor_training_progress")
    .upsert({ instructor_id: user!.id, module_key }, { onConflict: "instructor_id,module_key" });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { error, supabase, user } = await auth();
  if (error) return error;
  const { module_key } = await request.json().catch(() => ({}));
  if (!VALID.has(module_key)) return NextResponse.json({ error: "invalid module_key" }, { status: 400 });

  const { error: dbErr } = await supabase!
    .from("instructor_training_progress")
    .delete()
    .eq("instructor_id", user!.id)
    .eq("module_key", module_key);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
