import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, notifyAdmin } from "@/lib/notifications/email";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { detectThreats } from "@/lib/security/input-filter";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email().max(120),
  phone: z.string().max(30).optional(),
  course_interest: z.string().max(200).optional(),
  motivation: z.string().max(2000).optional(),
  availability: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
});

/**
 * POST /api/beta/apply
 *
 * 비로그인 접근 가능. IP rate limit (auth:login 정책 재사용 — 15분당 5회) + 입력 위협 필터.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Brute force/스팸 방어 — IP 기준 15분 5회
  const rl = await checkRateLimit("auth:login", null, { ipFallback: ip });
  if (!rl.allowed) return rateLimitResponse(rl, "신청 시도가 너무 많습니다. 잠시 후 다시 시도하세요.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  // 위협 검사 (motivation 본문)
  const threat = detectThreats(parsed.data.motivation ?? "");
  if (threat.blocked) {
    return NextResponse.json({ error: "input_blocked" }, { status: 400 });
  }

  const admin = createAdminClient();
  const emailLower = parsed.data.email.toLowerCase();

  // 중복 신청 — 이미 있으면 같은 응답 (UX), 새로 INSERT 시도하지 않음
  const { data: existing } = await admin
    .from("beta_applications")
    .select("id, status")
    .eq("email", emailLower)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, status: existing.status });
  }

  const { data: row, error } = await admin
    .from("beta_applications")
    .insert({
      name: parsed.data.name,
      email: emailLower,
      phone: parsed.data.phone ?? null,
      course_interest: parsed.data.course_interest ?? null,
      motivation: parsed.data.motivation ?? null,
      availability: parsed.data.availability ?? null,
      source: parsed.data.source ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "insert_failed", detail: error?.message }, { status: 500 });
  }

  // 본부장 알림
  await notifyAdmin({
    title: `📩 신규 베타 신청 — ${parsed.data.name}`,
    fields: [
      { title: "이메일", value: parsed.data.email },
      { title: "관심 과정", value: parsed.data.course_interest ?? "(미기재)" },
      { title: "이용 시간대", value: parsed.data.availability ?? "(미기재)" },
      { title: "신청 동기", value: (parsed.data.motivation ?? "(미기재)").slice(0, 300) },
    ],
    level: "ok",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/beta-applications`,
    action_label: "검토하기 →",
  });

  // 신청자 접수 확인 메일
  await sendEmail({
    to: [parsed.data.email],
    subject: "KEG AI Studio 베타 신청이 접수되었습니다",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
      <h1 style="font-size:20px;font-weight:600;">${escape(parsed.data.name)}님, 신청이 접수되었습니다 🎉</h1>
      <p style="font-size:14px;line-height:1.7;">베타 참여 신청을 보내주셔서 감사합니다. 검토 후 2영업일 이내에 결과를 이메일로 안내드립니다.</p>
      <p style="font-size:14px;line-height:1.7;">승인 시 가입 안내 메일이 별도로 발송됩니다.</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
      <p style="font-size:12px;color:#71717a;">KEG AI Studio · 자동 발송 메일</p>
    </body></html>`,
    text: `${parsed.data.name}님, 베타 신청이 접수되었습니다. 2영업일 내 결과 안내 드립니다.`,
  });

  return NextResponse.json({ ok: true, application_id: row.id });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
