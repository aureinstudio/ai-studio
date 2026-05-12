import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  category: z.enum(["went_well", "tough", "do_differently"]),
  content: z.string().min(5).max(1000),
  gate_id: z.string().max(10).default("G2"),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { error } = await admin.from("retrospective_entries").insert({
    gate_id: parsed.data.gate_id,
    category: parsed.data.category,
    content: parsed.data.content,
    author_id: user.id,
    author_name: profile?.name ?? null,
  });
  if (error) return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
