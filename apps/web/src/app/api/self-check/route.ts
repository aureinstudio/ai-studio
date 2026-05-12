import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  week_iso: z.string().regex(/^\d{4}-W\d{2}$/),
  satisfaction: z.number().int().min(1).max(5),
  tutor_helpful: z.number().int().min(1).max(5).nullable().optional(),
  hardest_part: z.string().max(1000).nullable().optional(),
  comments: z.string().max(1000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { error } = await supabase.from("student_feedback").insert({
    user_id: user.id,
    week_iso: parsed.data.week_iso,
    satisfaction: parsed.data.satisfaction,
    tutor_helpful: parsed.data.tutor_helpful ?? null,
    hardest_part: parsed.data.hardest_part ?? null,
    comments: parsed.data.comments ?? null,
  });

  if (error) {
    // 중복 (이번 주 이미 작성) 또는 권한 — 메시지 정제
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_submitted_this_week" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
