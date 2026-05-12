import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  choice: z.enum(["continue_full", "delete_all", "anonymous_stats_only"]),
  note: z.string().max(500).nullable().optional(),
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
  const { error } = await admin
    .from("beta_end_choices")
    .upsert({
      user_id: user.id,
      choice: parsed.data.choice,
      note: parsed.data.note ?? null,
      chosen_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: "upsert_failed", detail: error.message }, { status: 500 });
  }

  // 'delete_all' 선택 → consent_log + profiles.deletion_scheduled_at 활용
  // (account-cleanup cron이 30일 후 실제 삭제 처리)
  if (parsed.data.choice === "delete_all") {
    const scheduledAt = new Date(Date.now() + 30 * 86400_000).toISOString();
    await admin
      .from("profiles")
      .update({ deletion_scheduled_at: scheduledAt })
      .eq("id", user.id);
  } else {
    // 다른 선택으로 변경 시 삭제 예약 취소
    await admin
      .from("profiles")
      .update({ deletion_scheduled_at: null })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
