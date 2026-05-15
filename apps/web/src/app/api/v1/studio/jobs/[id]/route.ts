import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiV1, recordApiUsage } from "@/lib/api/v1/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/studio/jobs/:id
 * 작업 상태 + 결과 조회. tenant 격리: 본인 테넌트 작업만.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiV1(request, "studio:read");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("studio_jobs")
    .select("id, status, topic, level, length, course_category, content, cost_usd, error, created_at, completed_at, tenant_id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    await recordApiUsage(ctx, `GET /api/v1/studio/jobs/${id}`, 500);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    await recordApiUsage(ctx, `GET /api/v1/studio/jobs/${id}`, 404);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // tenant 격리
  if (job.tenant_id !== ctx.tenantId && ctx.tenantId !== null) {
    await recordApiUsage(ctx, `GET /api/v1/studio/jobs/${id}`, 404);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await recordApiUsage(ctx, `GET /api/v1/studio/jobs/${id}`, 200);
  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    topic: job.topic,
    level: job.level,
    length: job.length,
    course_category: job.course_category,
    content: job.status === "completed" ? job.content : null,
    cost_usd: job.cost_usd,
    error: job.error,
    created_at: job.created_at,
    completed_at: job.completed_at,
  });
}
