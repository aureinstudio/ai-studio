import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectThreats } from "@/lib/security/input-filter";

export const runtime = "nodejs";

const schema = z.object({
  week_iso: z.string().regex(/^\d{4}-W\d{2}$/),
  used_studio_content: z.boolean(),
  content_count: z.number().int().min(0).max(100).default(0),
  utility_rating: z.number().int().min(1).max(5).nullable().optional(),
  comments: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.comments) {
    const t = detectThreats(parsed.data.comments);
    if (t.blocked) return NextResponse.json({ error: "input_blocked" }, { status: 400 });
  }

  // 기존 주차 row 갱신 또는 INSERT
  const { data: existing } = await admin
    .from("instructor_usage_reports")
    .select("id")
    .eq("instructor_id", user.id)
    .eq("week_iso", parsed.data.week_iso)
    .maybeSingle();

  const row = {
    instructor_id: user.id,
    instructor_name: profile?.name ?? null,
    week_iso: parsed.data.week_iso,
    used_studio_content: parsed.data.used_studio_content,
    content_count: parsed.data.content_count,
    utility_rating: parsed.data.utility_rating ?? null,
    comments: parsed.data.comments ?? null,
  };

  if (existing) {
    await admin.from("instructor_usage_reports").update(row).eq("id", existing.id);
  } else {
    await admin.from("instructor_usage_reports").insert(row);
  }

  return NextResponse.json({ ok: true });
}
