import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ComprehensionEvaluator } from "@/lib/agents/tutor/comprehension-evaluator";
import { RecommendationEngine } from "@/lib/agents/tutor/recommendation-engine";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  conversation_id: z.string().uuid(),
  weeks_until_exam: z.number().int().min(0).max(52).nullable().optional(),
});

/**
 * POST /api/tutor/evaluate
 *
 * 대화 → 이해도 평가 (#05) + 학습 권장 (#06) → tutor_understanding 저장.
 * 학생이 명시 트리거 또는 일정 임계값 도달 시 자동.
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

  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("tutor_conversations")
    .select(
      "id, student_id, studio_job_id, messages, total_messages, rejected_count",
    )
    .eq("id", parsed.data.conversation_id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  if (conv.student_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if ((conv.total_messages ?? 0) < 4) {
    return NextResponse.json(
      { error: "not_enough_messages", required: 4, current: conv.total_messages },
      { status: 400 },
    );
  }

  const { data: job } = await admin
    .from("studio_jobs")
    .select("topic")
    .eq("id", conv.studio_job_id)
    .maybeSingle();

  try {
    // #05 이해도 평가
    type Msg = { role: "user" | "assistant"; content: string };
    const messages = (conv.messages ?? []) as Msg[];
    const evaluator = new ComprehensionEvaluator();
    const r05 = await evaluator.execute({
      student_label: user.email?.split("@")[0] ?? user.id.slice(0, 8),
      course_topic: job?.topic ?? "(미상)",
      conversation_summary: "",
      total_messages: conv.total_messages ?? 0,
      rejected_count: conv.rejected_count ?? 0,
      recent_messages: messages,
    });
    await logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/evaluate",
      userId: user.id,
      tokensIn: r05.log.tokens_in,
      tokensOut: r05.log.tokens_out,
      costUsd: r05.log.cost_usd,
      metadata: { stage: "comprehension", conversation_id: parsed.data.conversation_id },
    });

    // #06 학습 권장
    const recommender = new RecommendationEngine();
    const r06 = await recommender.execute({
      course_topic: job?.topic ?? "(미상)",
      comprehension: r05.output,
      weeks_until_exam: parsed.data.weeks_until_exam ?? undefined,
    });
    await logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/evaluate",
      userId: user.id,
      tokensIn: r06.log.tokens_in,
      tokensOut: r06.log.tokens_out,
      costUsd: r06.log.cost_usd,
      metadata: { stage: "recommendation", conversation_id: parsed.data.conversation_id },
    });

    // tutor_understanding 저장
    const { data: understanding } = await admin
      .from("tutor_understanding")
      .insert({
        student_id: user.id,
        studio_job_id: conv.studio_job_id,
        source_conversation_id: conv.id,
        overall_score: r05.output.overall_understanding,
        by_chapter: r05.output.by_chapter,
        weak_concepts: r05.output.weak_concepts,
        learning_style: r05.output.learning_style_observations,
        recommended_focus: r05.output.recommended_focus_areas,
        estimated_exam_readiness: r05.output.estimated_exam_readiness,
        trend: r05.output.trend,
        recommendation: r06.output,
      })
      .select("id")
      .single();

    return NextResponse.json({
      understanding_id: understanding?.id,
      comprehension: r05.output,
      recommendation: r06.output,
      cost_usd: r05.log.cost_usd + r06.log.cost_usd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tutor/evaluate] failed:", err);
    return NextResponse.json(
      { error: "evaluate_failed", detail: message },
      { status: 500 },
    );
  }
}
