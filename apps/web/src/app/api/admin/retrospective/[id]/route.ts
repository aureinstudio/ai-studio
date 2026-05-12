import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  // 본인 글만 삭제 (RLS도 별도 보호)
  const { data: row } = await admin
    .from("retrospective_entries")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.author_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await admin.from("retrospective_entries").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
