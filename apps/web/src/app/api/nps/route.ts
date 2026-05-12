import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectThreats } from "@/lib/security/input-filter";
import { notifyAdmin } from "@/lib/notifications/email";

export const runtime = "nodejs";

const schema = z.object({
  score: z.number().int().min(0).max(10),
  reason: z.string().max(1000).nullable().optional(),
  segment: z.enum(["ko", "multilingual"]).default("ko"),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.reason) {
    const t = detectThreats(parsed.data.reason);
    if (t.blocked) return NextResponse.json({ error: "input_blocked" }, { status: 400 });
  }

  const { error } = await supabase.from("nps_responses").insert({
    user_id: user.id,
    score: parsed.data.score,
    reason: parsed.data.reason ?? null,
    segment: parsed.data.segment,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_responded_this_week" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  // Detractor (0-6)이면 즉시 본부장 알림
  if (parsed.data.score <= 6) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("email, name").eq("id", user.id).maybeSingle();
    await notifyAdmin({
      title: `😟 Detractor NPS ${parsed.data.score} — ${profile?.name ?? user.id.slice(0, 8)}`,
      body: parsed.data.reason ?? "(사유 없음)",
      fields: [
        { title: "이메일", value: profile?.email ?? "(없음)" },
        { title: "Segment", value: parsed.data.segment },
        { title: "점수", value: `${parsed.data.score}/10` },
      ],
      level: "warning",
      action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/at-risk-students`,
      action_label: "위험 학생 →",
    });
  }

  return NextResponse.json({ ok: true });
}
