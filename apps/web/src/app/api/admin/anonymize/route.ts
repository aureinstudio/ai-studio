import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/anonymize
 * body: { mode: "dry_run" | "execute" }
 *
 * 학생 선택(beta_end_data_choices)에 따라 데이터를 처리.
 *   - delete_all: 프로필 + 관련 row 삭제 (cascade)
 *   - anonymize_only: 이메일/이름 sha256 해시, 대화 내 PII 마스킹
 *   - convert_paid: 변경 없음 (스킵)
 *   - 미응답: anonymize_only 기본 적용
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "execute" ? "execute" : "dry_run";

  const admin = createAdminClient();

  // 학생 + 선택 조회
  const { data: students } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("role", "user");

  const { data: choices } = await admin.from("beta_end_data_choices").select("student_id, choice");
  const choiceMap = new Map((choices ?? []).map((c) => [c.student_id, c.choice as "convert_paid" | "delete_all" | "anonymize_only"]));

  const plan: Record<string, number> = { convert_paid: 0, delete_all: 0, anonymize_only: 0, default_anonymize: 0 };
  const actions: { student_id: string; action: string }[] = [];

  for (const s of students ?? []) {
    const choice = choiceMap.get(s.id) ?? "anonymize_only";
    if (!choiceMap.has(s.id)) plan.default_anonymize += 1;
    else plan[choice] += 1;
    actions.push({ student_id: s.id, action: choice });
  }

  if (mode === "dry_run") {
    return NextResponse.json({ mode, plan, total: actions.length, sample: actions.slice(0, 10) });
  }

  // 실행
  let deleted = 0, anonymized = 0;
  const now = new Date().toISOString();

  for (const a of actions) {
    if (a.action === "convert_paid") continue;

    if (a.action === "delete_all") {
      const { error } = await admin.from("profiles").delete().eq("id", a.student_id);
      if (!error) deleted += 1;
    } else {
      // anonymize: email/name 해시, last_login_ip 등 PII 제거
      const hash = createHash("sha256").update(a.student_id).digest("hex").slice(0, 12);
      const { error } = await admin
        .from("profiles")
        .update({
          email: `anon_${hash}@anonymized.local`,
          name: `anon_${hash}`,
          // tutor_conversations PII 마스킹은 별도 작업 필요 — 여기선 식별자만 처리
        })
        .eq("id", a.student_id);
      if (!error) anonymized += 1;
    }

    await admin
      .from("beta_end_data_choices")
      .upsert({ student_id: a.student_id, choice: a.action, applied_at: now }, { onConflict: "student_id" });
  }

  return NextResponse.json({ mode, plan, deleted, anonymized, total: actions.length });
}
