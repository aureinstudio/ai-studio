import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  role: z.enum(["user", "admin", "sme", "instructor", "operations", "creator"]),
});

/**
 * PATCH /api/admin/users/[id]  body: { role }
 *
 * 사용자 역할 변경 (admin 전용).
 * profiles.role check constraint와 일치하는 enum 강제.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (caller?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  // 자기 자신을 admin 외 역할로 강등 차단 (락아웃 방지)
  if (id === user.id && parsed.data.role !== "admin") {
    return NextResponse.json(
      { error: "cannot_demote_self", message: "본인을 admin이 아닌 역할로 변경할 수 없습니다." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: parsed.data.role });
}
