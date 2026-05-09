import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/studio/jobs/[id] — Polling endpoint.
 *
 * 클라이언트가 1~2초 간격으로 호출하여 진행 상황 확인.
 * RLS는 본인 row만 조회 허용 (다른 사용자 job 조회 불가).
 *
 * 응답 schema:
 *   {
 *     id, status: 'pending' | 'running' | 'completed' | 'failed',
 *     agent_logs: AgentLog[],            // 실시간 누적
 *     content: { curator, planner } | null,  // completed 후 채워짐
 *     cost_usd: number | null,
 *     duration_seconds: number | null,
 *     error: string | null,
 *     created_at: string
 *   }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from("studio_jobs")
    .select(
      "id, status, agent_logs, content, cost_usd, duration_seconds, error, topic, level, length, created_at",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No row — RLS 차단 또는 존재 안 함
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(job);
}
