import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tutor/conversations?limit=20&offset=0
 *
 * 본인 tutor_conversations 목록 (last_active_at DESC).
 * studio_jobs.topic 함께 조회 (어떤 과정의 대화인지 표시).
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
    .from("tutor_conversations")
    .select(
      "id, studio_job_id, total_messages, rejected_count, total_cost_usd, language, last_active_at, created_at, studio_jobs!inner(topic)",
      { count: "exact" },
    )
    .eq("student_id", user.id)
    .order("last_active_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    studio_job_id: string;
    total_messages: number | null;
    rejected_count: number | null;
    total_cost_usd: number | null;
    language: string | null;
    last_active_at: string;
    created_at: string;
    studio_jobs?: { topic: string } | { topic: string }[] | null;
  };

  const conversations = (data ?? []).map((r) => {
    const row = r as unknown as Row;
    const studio = Array.isArray(row.studio_jobs) ? row.studio_jobs[0] : row.studio_jobs;
    return {
      id: row.id,
      topic: studio?.topic ?? "(주제 미상)",
      studio_job_id: row.studio_job_id,
      total_messages: row.total_messages ?? 0,
      rejected_count: row.rejected_count ?? 0,
      cost_usd: row.total_cost_usd ?? 0,
      language: row.language ?? "ko",
      last_active_at: row.last_active_at,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({
    conversations,
    total: count ?? conversations.length,
    hasMore: conversations.length === limit,
  });
}
