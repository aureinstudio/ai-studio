import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/legal/data-export
 *
 * 본인의 모든 데이터를 JSON으로 반환 (다운로드).
 * 개인정보보호법 정보주체 권리 — 열람·이동권.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const uid = user.id;

  // 본인 데이터 수집 (RLS 자동 적용)
  const [profile, studioJobs, costLog, castJobs, userAvatars, tutorConvs, tutorUnderstandings, consentLog] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("studio_jobs").select("*").eq("user_id", uid).is("deleted_at", null),
      supabase.from("cost_log").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1000),
      supabase.from("cast_jobs").select("*").eq("user_id", uid).is("deleted_at", null),
      supabase.from("user_avatars").select("*").eq("user_id", uid).is("deleted_at", null),
      supabase.from("tutor_conversations").select("*").eq("student_id", uid).is("deleted_at", null),
      supabase.from("tutor_understanding").select("*").eq("student_id", uid),
      supabase.from("consent_log").select("*").eq("user_id", uid),
    ]);

  const exportData = {
    meta: {
      service: "KEG AI Studio",
      export_date: new Date().toISOString(),
      user_id: uid,
      email: user.email,
      note: "개인정보보호법 정보주체 권리에 따른 본인 데이터 내보내기",
    },
    profile: profile.data,
    studio_jobs: studioJobs.data ?? [],
    cast_jobs: castJobs.data ?? [],
    user_avatars: userAvatars.data ?? [],
    tutor_conversations: tutorConvs.data ?? [],
    tutor_understanding: tutorUnderstandings.data ?? [],
    consent_log: consentLog.data ?? [],
    cost_log: costLog.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="keg-data-${uid.slice(0, 8)}.json"`,
    },
  });
}
