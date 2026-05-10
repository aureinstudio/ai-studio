import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/studio/jobs?limit=20&offset=0&q=keyword
 *
 * 본인 studio_jobs 목록 (soft-deleted 제외, created_at DESC).
 * `q` 쿼리는 topic ILIKE 검색.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);
  const q = searchParams.get("q")?.trim();

  let query = supabase
    .from("studio_jobs")
    .select(
      "id, topic, level, length, status, cost_usd, duration_seconds, created_at",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike("topic", `%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    jobs: data ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
  });
}
