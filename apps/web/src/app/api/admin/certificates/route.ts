import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, wrapEmailHtml } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations","instructor","sme"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { student_email, student_name, course_name, course_category, score } = body;
  if (!student_email || !student_name || !course_name) {
    return NextResponse.json({ error: "student_email, student_name, course_name required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 학생 ID 조회 (이메일로)
  const { data: student } = await admin.from("profiles").select("id").eq("email", student_email).maybeSingle();
  if (!student) return NextResponse.json({ error: "student not found by email" }, { status: 404 });

  // 인증서 번호 생성 — KEG-YYYY-NNNNNN
  const year = new Date().getFullYear();
  const { count } = await admin.from("certificates").select("id", { count: "exact", head: true }).like("certificate_number", `KEG-${year}-%`);
  const seq = String((count ?? 0) + 1).padStart(6, "0");
  const certNumber = `KEG-${year}-${seq}`;

  const { data: cert, error } = await admin.from("certificates").insert({
    user_id: student.id,
    student_name,
    course_name,
    course_category,
    certificate_number: certNumber,
    completion_date: new Date().toISOString().slice(0, 10),
    score: typeof score === "number" ? score : null,
  }).select("certificate_number").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 이메일 발송
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ai-studio-drab-nine.vercel.app";
  const certUrl = `${baseUrl}/certificates/${certNumber}`;
  await sendEmail({
    to: student_email,
    subject: `[ai-studio] ${course_name} 수료증 발급`,
    html: wrapEmailHtml(
      "수료증 발급",
      `<p>${student_name}님,</p>
       <p><b>${course_name}</b> 과정 수료를 축하드립니다.</p>
       <p>수료증 번호: <code>${certNumber}</code></p>
       <p><a href="${certUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">수료증 보기</a></p>`
    ),
    template: "certificate_issued",
    related_table: "certificates",
    related_id: cert.certificate_number,
  });

  return NextResponse.json({ ok: true, certificate_number: certNumber });
}
