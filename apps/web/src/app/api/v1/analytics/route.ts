import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiV1, recordApiUsage } from "@/lib/api/v1/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/analytics?days=30
 *
 * 본인 테넌트의 누적 KPI:
 *   - 학생 수, 강사 수
 *   - Studio·Cast 작업 수
 *   - 누적 비용
 *   - Tutor 대화 수
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiV1(request, "analytics:read");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const admin = createAdminClient();
  if (!ctx.tenantId) {
    await recordApiUsage(ctx, "GET /api/v1/analytics", 400);
    return NextResponse.json({ error: "tenant_unknown" }, { status: 400 });
  }

  const [
    { count: students },
    { count: instructors },
    { count: studio },
    { count: studioCompleted },
    { count: cast },
    { count: tutor },
    { data: costs },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("role", "user"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("role", "instructor"),
    admin.from("studio_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("created_at", since),
    admin.from("studio_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("status", "completed").gte("created_at", since),
    admin.from("cast_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("created_at", since),
    admin.from("tutor_conversations").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("created_at", since),
    admin.from("studio_jobs").select("cost_usd").eq("tenant_id", ctx.tenantId).gte("created_at", since),
  ]);

  const totalCost = (costs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);

  await recordApiUsage(ctx, "GET /api/v1/analytics", 200);
  return NextResponse.json({
    period_days: days,
    students: students ?? 0,
    instructors: instructors ?? 0,
    studio_jobs: studio ?? 0,
    studio_jobs_completed: studioCompleted ?? 0,
    cast_jobs: cast ?? 0,
    tutor_conversations: tutor ?? 0,
    total_cost_usd: Math.round(totalCost * 100) / 100,
  });
}
