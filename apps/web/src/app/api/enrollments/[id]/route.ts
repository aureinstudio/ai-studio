import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["active", "paused", "completed", "dropped"]),
});

/**
 * PATCH /api/enrollments/{id}  body: { status }
 * DELETE /api/enrollments/{id}             — hard drop (status='dropped'로 약화 권장)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { error } = await supabase
    .from("student_enrollments")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("student_id", user.id);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  // hard delete 대신 status='dropped'로 — 통계 보존
  const { error } = await supabase
    .from("student_enrollments")
    .update({ status: "dropped" })
    .eq("id", id)
    .eq("student_id", user.id);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
