import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexStudioJob } from "@/lib/rag/indexer";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  studio_job_id: z.string().uuid(),
});

/**
 * POST /api/tutor/index
 *
 * Studio 작업 → RAG 임베딩 생성. 본인 작업만 인덱싱 가능.
 * 응답: { chunks_indexed, cost_usd, duration_ms }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // 권한 확인 — 본인 작업 또는 샘플
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, user_id, is_sample, status")
    .eq("id", parsed.data.studio_job_id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (job.user_id !== user.id && !job.is_sample) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "job_not_completed", current_status: job.status },
      { status: 400 },
    );
  }

  try {
    const result = await indexStudioJob(admin, parsed.data.studio_job_id);

    await logCost({
      supabase: admin,
      service: "gemini",
      endpoint: "/v1beta/embedContent",
      userId: user.id,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: result.cost_usd,
      metadata: {
        studio_job_id: parsed.data.studio_job_id,
        chunks_indexed: result.chunks_indexed,
        purpose: "rag_index",
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tutor/index] failed for ${parsed.data.studio_job_id}:`, err);
    return NextResponse.json(
      { error: "index_failed", detail: message },
      { status: 500 },
    );
  }
}
