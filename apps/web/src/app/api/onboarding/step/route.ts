import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  state: z.object({
    step: z.number().int().min(1).max(5).optional(),
    target_cert: z.string().max(100).optional(),
    exam_date: z.string().max(20).optional(),
    preferred_hours: z.array(z.string().max(40)).max(10).optional(),
    language: z.enum(["ko", "en", "zh", "vi", "id"]).optional(),
    first_question_asked: z.boolean().optional(),
    completed_at: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = createAdminClient();

  // 기존 state merge — 부분 갱신
  const { data: prof } = await admin
    .from("profiles")
    .select("onboarding_state, learning_prefs")
    .eq("id", user.id)
    .maybeSingle();
  const prev = (prof?.onboarding_state ?? {}) as Record<string, unknown>;
  const merged = { ...prev, ...parsed.data.state };

  // learning_prefs도 함께 동기화 (language·daily_reminder 등)
  const prevPrefs = (prof?.learning_prefs ?? {}) as Record<string, unknown>;
  const nextPrefs = {
    ...prevPrefs,
    ...(parsed.data.state.language ? { language: parsed.data.state.language } : {}),
    ...(parsed.data.state.preferred_hours ? { preferred_hours: parsed.data.state.preferred_hours } : {}),
    daily_reminder: prevPrefs.daily_reminder ?? true,
  };

  await admin
    .from("profiles")
    .update({
      onboarding_state: merged,
      learning_prefs: nextPrefs,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  // 완료 시 beta_applications.first_login_at·status 갱신
  if (parsed.data.state.completed_at && user.email) {
    await admin
      .from("beta_applications")
      .update({
        status: "onboarded",
        first_login_at: new Date().toISOString(),
        invited_user_id: user.id,
      })
      .eq("email", user.email.toLowerCase())
      .in("status", ["approved", "pending"]);
  }

  return NextResponse.json({ ok: true, state: merged });
}
