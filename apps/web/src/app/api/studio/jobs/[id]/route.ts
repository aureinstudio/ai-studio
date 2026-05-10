import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/studio/jobs/[id] — Polling + Detail endpoint.
 *
 * 본인 row만 조회 (soft-deleted 제외).
 * RLS는 user_id 매칭만 검사하므로 deleted_at은 쿼리 레벨에서 필터.
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
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(job);
}

/**
 * DELETE /api/studio/jobs/[id] — Soft delete.
 * RLS UPDATE 정책: auth.uid() = user_id 만 허용.
 * 작업 자체는 보존되고 deleted_at 타임스탬프만 set.
 */
export async function DELETE(
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

  // 이미 삭제된 row는 update 대상에서 제외 (멱등성)
  const { data, error } = await supabase
    .from("studio_jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // 본인 소유 아님(RLS 차단) 또는 존재 안 함 또는 이미 삭제
      return NextResponse.json({ error: "not_found_or_already_deleted" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id, deleted: true });
}
