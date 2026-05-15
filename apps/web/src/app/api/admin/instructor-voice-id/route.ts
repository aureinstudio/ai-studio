import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/instructor-voice-id
 * body: { instructor_id, voice_id }
 *
 * HeyGen 대시보드에서 강사 voice를 수동으로 클론한 후 voice_id를 입력하는 fallback.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { instructor_id, voice_id } = body;
  if (!instructor_id || !voice_id || typeof voice_id !== "string") {
    return NextResponse.json({ error: "instructor_id and voice_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("instructor_assets")
    .upsert(
      { instructor_id, heygen_voice_id: voice_id.trim(), updated_at: new Date().toISOString() },
      { onConflict: "instructor_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
