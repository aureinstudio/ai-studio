import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cast/jobs?limit=20&offset=0
 *
 * 본인 cast_jobs 목록 (soft-deleted 제외, created_at DESC).
 * Studio job의 topic을 함께 조회 (history UI 표시용).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const { data, error, count } = await supabase
    .from("cast_jobs")
    .select(
      "id, studio_job_id, status, cost_usd, duration_seconds, video_url, created_at, completed_at, studio_jobs!inner(topic)",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    studio_job_id: string | null;
    status: string;
    cost_usd: number | null;
    duration_seconds: number | null;
    video_url: string | null;
    created_at: string;
    completed_at: string | null;
    studio_jobs?: { topic: string } | { topic: string }[] | null;
  };

  const jobs = (data ?? []).map((r) => {
    const row = r as unknown as Row;
    const studio = Array.isArray(row.studio_jobs) ? row.studio_jobs[0] : row.studio_jobs;
    return {
      id: row.id,
      topic: studio?.topic ?? "(주제 미상)",
      studio_job_id: row.studio_job_id,
      status: row.status,
      cost_usd: row.cost_usd,
      duration_seconds: row.duration_seconds,
      video_url: row.video_url,
      created_at: row.created_at,
      completed_at: row.completed_at,
    };
  });

  return NextResponse.json({
    jobs,
    total: count ?? jobs.length,
    hasMore: jobs.length === limit,
  });
}
