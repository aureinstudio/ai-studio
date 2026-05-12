import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/notifications/email";
import { detectThreats } from "@/lib/security/input-filter";

export const runtime = "nodejs";

const schema = z.object({
  conversation_id: z.string().uuid().optional(),
  message_index: z.number().int().min(0).optional(),
  studio_job_id: z.string().uuid().optional(),
  issue_type: z.enum(["factual_error", "inappropriate", "incomplete", "other"]),
  detail: z.string().max(2000).optional(),
});

/**
 * POST /api/content-reports
 *
 * Tutor 답변 신고. UI 위치: Tutor 응답 카드 아래 "이 답변에 문제가 있나요?" 버튼.
 * SME에게 즉시 알림 (현재는 notifyAdmin으로 본부장 — SME 라우팅은 후속 작업).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.detail) {
    const t = detectThreats(parsed.data.detail);
    if (t.blocked) return NextResponse.json({ error: "input_blocked" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("content_reports")
    .insert({
      user_id: user.id,
      conversation_id: parsed.data.conversation_id ?? null,
      message_index: parsed.data.message_index ?? null,
      studio_job_id: parsed.data.studio_job_id ?? null,
      issue_type: parsed.data.issue_type,
      detail: parsed.data.detail ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "insert_failed", detail: error?.message }, { status: 500 });
  }

  // SME/admin 알림 — issue_type=factual_error는 warning, 그 외 정보
  await notifyAdmin({
    title: `📝 콘텐츠 신고 [${parsed.data.issue_type}]`,
    body: parsed.data.detail ?? "(상세 없음)",
    fields: [
      { title: "신고 ID", value: row.id.slice(0,8) },
      ...(parsed.data.studio_job_id ? [{ title: "Studio job", value: parsed.data.studio_job_id.slice(0,8) }] : []),
      ...(parsed.data.conversation_id ? [{ title: "Conversation", value: parsed.data.conversation_id.slice(0,8) }] : []),
    ],
    level: parsed.data.issue_type === "factual_error" ? "warning" : "ok",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin`,
    action_label: "관리자 →",
  });

  return NextResponse.json({ ok: true, report_id: row.id });
}
