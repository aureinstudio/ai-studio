import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

/**
 * PATCH /api/beta/applications/{id}
 *
 * admin 전용. action='approve' 시 매직 링크 생성 + 환영 메일 발송.
 * action='reject' 시 정중한 거부 메일 발송.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: app } = await admin
    .from("beta_applications")
    .select("id, name, email, status")
    .eq("id", id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";

  if (parsed.data.action === "approve") {
    // Supabase magic link 생성 — 가입(signup) 또는 기존 사용자 로그인 모두 처리
    // generateLink는 service_role 전용.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: app.email,
      options: { redirectTo: `${baseUrl}/onboarding` },
    });
    if (linkErr) {
      return NextResponse.json({ error: "link_generation_failed", detail: linkErr.message }, { status: 500 });
    }
    const actionUrl = link?.properties?.action_link;

    await sendEmail({
      to: [app.email],
      subject: `🎉 KEG AI Studio 베타 승인 — ${app.name}님`,
      html: welcomeHtml(app.name, actionUrl ?? `${baseUrl}/signup`),
      text: `${app.name}님, 베타 참여가 승인되었습니다. 가입 링크: ${actionUrl ?? baseUrl}`,
    });

    await admin
      .from("beta_applications")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        invite_sent_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, action: "approve", link_sent: true });
  }

  // reject
  await sendEmail({
    to: [app.email],
    subject: "KEG AI Studio 베타 신청 결과 안내",
    html: rejectHtml(app.name, parsed.data.note),
    text: `${app.name}님, 이번 베타 모집은 정원 등의 사유로 안내드리지 못합니다. 다음 기회에 함께하길 기대합니다.`,
  });

  await admin
    .from("beta_applications")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, action: "reject" });
}

function welcomeHtml(name: string, link: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:22px;font-weight:700;">${esc(name)}님, 환영합니다 🎉</h1>
    <p style="font-size:14px;line-height:1.7;">KEG AI Studio 베타 참여가 승인되었습니다. 아래 버튼을 눌러 시작하세요.</p>
    <p style="margin:24px 0;"><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">베타 시작하기 →</a></p>
    <p style="font-size:13px;color:#71717a;">링크는 30분간 유효합니다. 만료 시 베타 페이지에서 다시 요청해 주세요.</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
    <h3 style="font-size:14px;font-weight:600;">첫 7일 추천 여정</h3>
    <ol style="font-size:13px;line-height:1.7;color:#52525b;padding-left:20px;">
      <li>온보딩 5단계 완료 (10분)</li>
      <li>관심 자격증 과정에서 첫 콘텐츠 학습 (Studio)</li>
      <li>이해 안 되는 부분은 AI Tutor에 질문 (24/7 가능)</li>
      <li>Cast 영상 강의로 핵심 개념 복습</li>
      <li>주말까지 5건 이상 Tutor 활용해 보세요</li>
    </ol>
    <p style="font-size:12px;color:#71717a;margin-top:24px;">문의: support@keg.com · KEG AI Studio</p>
  </body></html>`;
}

function rejectHtml(name: string, note?: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
    <h1 style="font-size:20px;font-weight:600;">${esc(name)}님, 안녕하세요</h1>
    <p style="font-size:14px;line-height:1.7;">베타 참여에 관심 가져주셔서 감사합니다. 이번 기수는 제한된 인원으로 진행되어 모든 신청자를 모시지 못하게 되었습니다.</p>
    ${note ? `<p style="font-size:14px;line-height:1.7;background:#f4f4f5;padding:12px;border-radius:6px;">${esc(note)}</p>` : ""}
    <p style="font-size:14px;line-height:1.7;">다음 기수 모집 시 우선 안내드리겠습니다. 양해 부탁드립니다.</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
    <p style="font-size:12px;color:#71717a;">KEG AI Studio</p>
  </body></html>`;
}
