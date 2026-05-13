import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const postSchema = z.object({
  studio_job_id: z.string().uuid(),
});

/**
 * GET /api/enrollments
 *
 * 본인 수강 목록 (active + paused, studio_jobs join).
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(
      "id, studio_job_id, status, enrolled_at, progress_data, studio_jobs!inner(topic, course_category, level, length, is_sample, status)",
    )
    .eq("student_id", user.id)
    .in("status", ["active", "paused"])
    .order("enrolled_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    studio_job_id: string;
    status: string;
    enrolled_at: string;
    progress_data: unknown;
    studio_jobs?:
      | { topic: string; course_category: string; level: string; length: string; is_sample: boolean; status: string }
      | { topic: string; course_category: string; level: string; length: string; is_sample: boolean; status: string }[]
      | null;
  };

  const enrollments = (data ?? []).map((r) => {
    const row = r as unknown as Row;
    const job = Array.isArray(row.studio_jobs) ? row.studio_jobs[0] : row.studio_jobs;
    return {
      id: row.id,
      studio_job_id: row.studio_job_id,
      status: row.status,
      enrolled_at: row.enrolled_at,
      progress_data: row.progress_data,
      topic: job?.topic ?? "(주제 미상)",
      course_category: job?.course_category ?? "certification",
      level: job?.level,
      length: job?.length,
      content_ready: job?.status === "completed",
    };
  });

  return NextResponse.json({ enrollments });
}

/**
 * POST /api/enrollments  body: { studio_job_id }
 *
 * 수강 등록. 같은 과정 중복은 unique 제약으로 자동 거부.
 * 비공개(is_sample=false) job은 본인 소유여야 등록 가능 (privacy).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, user_id, is_sample, status")
    .eq("id", parsed.data.studio_job_id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  // 공개 sample 또는 본인 콘텐츠만 등록 가능
  if (!job.is_sample && job.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden", message: "공개 과정이 아닙니다." }, { status: 403 });
  }
  if (job.status !== "completed") {
    return NextResponse.json({ error: "course_not_ready", message: "콘텐츠 생성이 아직 완료되지 않았습니다." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("student_enrollments")
    .insert({
      student_id: user.id,
      studio_job_id: parsed.data.studio_job_id,
      status: "active",
    })
    .select("id, status, enrolled_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_enrolled", message: "이미 등록된 과정입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enrollment: row });
}
