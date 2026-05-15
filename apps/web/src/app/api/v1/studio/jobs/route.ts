import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiV1, recordApiUsage } from "@/lib/api/v1/auth";
import { runDynamicChain } from "@/lib/agents/orchestrator-dynamic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_CATEGORY = new Set(["certification", "professional", "language", "hobby", "academic"]);
const VALID_LEVEL = new Set(["beginner", "intermediate", "advanced"]);
const VALID_LENGTH = new Set(["short", "medium", "long"]);

/**
 * POST /api/v1/studio/jobs
 * body: { topic, level?, length?, course_category?, model? }
 *
 * Studio 작업 생성. 응답에 job_id 즉시 반환, 백그라운드 실행.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiV1(request, "studio:write");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.topic !== "string" || !body.topic.trim()) {
    await recordApiUsage(ctx, "POST /api/v1/studio/jobs", 400);
    return NextResponse.json({ error: "invalid_body", message: "topic (string) required" }, { status: 400 });
  }

  const level = body.level && VALID_LEVEL.has(body.level) ? body.level : "intermediate";
  const length = body.length && VALID_LENGTH.has(body.length) ? body.length : "medium";
  const category = body.course_category && VALID_CATEGORY.has(body.course_category)
    ? body.course_category
    : "certification";
  const model = typeof body.model === "string" ? body.model : "claude-sonnet-4-5";

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("studio_jobs")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      topic: body.topic.toString().slice(0, 500),
      level,
      length,
      model,
      course_category: category,
      status: "pending",
      agent_logs: [],
    })
    .select("id, status, topic, level, length, course_category, created_at")
    .single();

  if (error || !job) {
    await recordApiUsage(ctx, "POST /api/v1/studio/jobs", 500);
    return NextResponse.json({ error: "creation_failed", detail: error?.message }, { status: 500 });
  }

  after(async () => {
    try {
      await runDynamicChain(admin, job.id, ctx.userId, {
        topic: body.topic,
        level,
        length,
        course_category: category as "certification" | "professional" | "language" | "hobby" | "academic",
      }, model);
    } catch (err) {
      console.error(`[api/v1/studio] chain failed ${job.id}:`, err);
    }
  });

  await recordApiUsage(ctx, "POST /api/v1/studio/jobs", 201);
  return NextResponse.json(
    {
      job_id: job.id,
      status: job.status,
      topic: job.topic,
      level: job.level,
      length: job.length,
      course_category: job.course_category,
      created_at: job.created_at,
    },
    { status: 201 },
  );
}
