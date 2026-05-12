import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  confirm_email: z.string().email(),
});

const GRACE_PERIOD_DAYS = 30;

/**
 * POST /api/legal/account-delete
 *
 * 계정 삭제 요청 (30일 유예). soft-delete로 deletion_requested_at·scheduled_at 설정.
 * 실제 hard-delete는 별도 cron 또는 admin 수동 처리 (Phase 2).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (parsed.data.confirm_email !== user.email) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const scheduled = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await admin
    .from("profiles")
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "deletion_request_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    deletion_requested_at: now.toISOString(),
    deletion_scheduled_at: scheduled.toISOString(),
    grace_period_days: GRACE_PERIOD_DAYS,
    message: `30일 후 자동 삭제됩니다. 그 전에 취소 가능합니다.`,
  });
}

/**
 * DELETE /api/legal/account-delete
 *
 * 삭제 요청 취소 (유예 기간 내).
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "cancel_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "삭제 요청이 취소되었습니다." });
}
