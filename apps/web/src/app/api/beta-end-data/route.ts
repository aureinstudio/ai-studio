import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["convert_paid", "anonymize_only", "delete_all"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { choice } = body;
  if (!VALID.has(choice)) return NextResponse.json({ error: "invalid choice" }, { status: 400 });

  const { error } = await supabase
    .from("beta_end_data_choices")
    .upsert({ student_id: user.id, choice }, { onConflict: "student_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
