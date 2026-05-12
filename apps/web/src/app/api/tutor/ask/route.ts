import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTutorChain } from "@/lib/agents/tutor/orchestrator-v1";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  question: z.string().min(2).max(500),
  studio_job_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  declared_language: z
    .enum(["ko", "en", "zh", "vi", "id"])
    .nullable()
    .optional(),
});

/**
 * POST /api/tutor/ask
 *
 * Tutor v1 — 5 에이전트 체인 (병렬·다국어):
 *   #01 IntentClassifier + #03 LanguageHandler (병렬, Haiku)
 *   → #02 RAG 검색 → #04 ResponseGenerator → #08 HallucinationChecker
 *
 * 응답 시간 목표: 5초 이내 (병렬 활용).
 * 비용: ~$0.02/호출.
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

  // 권한·콘텐츠 검증
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, user_id, is_sample, topic")
    .eq("id", parsed.data.studio_job_id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.user_id !== user.id && !job.is_sample) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Tutor 체인 실행
    const result = await runTutorChain(admin, {
      question: parsed.data.question,
      studio_job_id: parsed.data.studio_job_id,
      course_topic: job.topic,
      conversation_id: parsed.data.conversation_id ?? null,
      declared_language: parsed.data.declared_language ?? undefined,
      user_id: user.id,
    });

    // 대화 저장 (append 또는 new)
    const userMessage = {
      role: "user" as const,
      content: parsed.data.question,
      timestamp: new Date().toISOString(),
    };
    const assistantMessage = {
      role: "assistant" as const,
      content: result.answer,
      verdict: result.verdict,
      intent: result.intent.intent,
      detected_language: result.language.detected_language,
      response_language: result.language.response_language,
      sources: result.sources.map((s) => ({
        similarity: s.similarity,
        source_type: s.source_type,
        preview: s.chunk_text.slice(0, 200),
      })),
      cost_usd: result.total_cost_usd,
      duration_ms: result.total_duration_ms,
      timestamp: new Date().toISOString(),
    };

    let conversationId = parsed.data.conversation_id ?? null;
    const isRejected = result.verdict === "rejected";

    if (conversationId) {
      const { data: conv } = await admin
        .from("tutor_conversations")
        .select("messages, total_messages, rejected_count, total_cost_usd")
        .eq("id", conversationId)
        .eq("student_id", user.id)
        .maybeSingle();
      if (conv) {
        const messages = [...(conv.messages ?? []), userMessage, assistantMessage];
        await admin
          .from("tutor_conversations")
          .update({
            messages,
            total_messages: (conv.total_messages ?? 0) + 2,
            rejected_count: (conv.rejected_count ?? 0) + (isRejected ? 1 : 0),
            total_cost_usd: Number(conv.total_cost_usd ?? 0) + result.total_cost_usd,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      }
    } else {
      const { data: newConv } = await admin
        .from("tutor_conversations")
        .insert({
          student_id: user.id,
          studio_job_id: parsed.data.studio_job_id,
          messages: [userMessage, assistantMessage],
          total_messages: 2,
          rejected_count: isRejected ? 1 : 0,
          total_cost_usd: result.total_cost_usd,
          language: result.language.response_language,
        })
        .select("id")
        .single();
      conversationId = newConv?.id ?? null;
    }

    return NextResponse.json({
      answer: result.answer,
      verdict: result.verdict,
      intent: result.intent.intent,
      complexity: result.intent.complexity,
      detected_language: result.language.detected_language,
      response_language: result.language.response_language,
      translated_query: result.language.translated_to_korean,
      block_reason: result.hallucination.block_reason,
      confidence_score: result.hallucination.confidence_score,
      ai_confidence: result.generator.confidence,
      suggested_next_step: result.generator.suggested_next_step,
      sources: result.sources.map((s, i) => ({
        index: i + 1,
        similarity: s.similarity,
        source_type: s.source_type,
        preview: s.chunk_text.slice(0, 200),
      })),
      cited_chunks: result.generator.cited_chunks,
      conversation_id: conversationId,
      cost_usd: result.total_cost_usd,
      duration_ms: result.total_duration_ms,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tutor/ask v1] failed:", err);
    return NextResponse.json(
      { error: "ask_failed", detail: message },
      { status: 500 },
    );
  }
}
