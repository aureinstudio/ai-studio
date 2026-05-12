import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmbedding } from "@/lib/rag/embedder";
import { RagAnswer } from "@/lib/agents/tutor/rag-answer";
import {
  HallucinationChecker,
  type SourceChunk,
} from "@/lib/agents/tutor/hallucination-checker";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  question: z.string().min(2).max(500),
  studio_job_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
});

const BLOCKED_RESPONSE =
  "이 질문은 교재에 명확한 근거가 없거나 안전상 답변하기 어렵습니다. 강사·관리자에게 직접 문의해 주세요.";

/**
 * POST /api/tutor/ask
 *
 * Tutor 질문 응답 — RAG + 환각 검증.
 *
 * 흐름:
 *   1. 질문 임베딩 (Gemini, RETRIEVAL_QUERY)
 *   2. RAG 검색 (top 5, 코사인 유사도)
 *   3. RagAnswer 에이전트 (Claude, 근거 기반 답변)
 *   4. HallucinationChecker (#08) — rejected 시 차단
 *   5. tutor_conversations 저장 + 응답 반환
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

  // 권한 확인 — Studio 작업이 본인 것 또는 샘플 + 인덱싱 됐는지
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, user_id, is_sample, topic")
    .eq("id", parsed.data.studio_job_id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.user_id !== user.id && !job.is_sample) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const totalCost = { value: 0 };

  try {
    // 1. 질문 임베딩
    const queryEmb = await createEmbedding(parsed.data.question, "RETRIEVAL_QUERY");
    totalCost.value += queryEmb.cost_usd;

    // 2. RAG 검색
    const { data: chunks, error: searchErr } = await admin.rpc("search_rag", {
      query_embedding: queryEmb.vector,
      job_filter: parsed.data.studio_job_id,
      match_count: 5,
    });
    if (searchErr) {
      return NextResponse.json(
        { error: "search_failed", detail: searchErr.message },
        { status: 500 },
      );
    }
    const sourceChunks: SourceChunk[] = (chunks ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({
        chunk_text: c.chunk_text,
        similarity: Number(c.similarity ?? 0),
        source_type: c.source_type ?? "unknown",
      }),
    );

    // 3. RAG 답변 생성
    const answerAgent = new RagAnswer();
    const r_answer = await answerAgent.execute({
      question: parsed.data.question,
      course_topic: job.topic,
      chunks: sourceChunks,
    });
    totalCost.value += r_answer.log.cost_usd;
    await logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/ask",
      userId: user.id,
      tokensIn: r_answer.log.tokens_in,
      tokensOut: r_answer.log.tokens_out,
      costUsd: r_answer.log.cost_usd,
      metadata: { stage: "rag_answer", studio_job_id: parsed.data.studio_job_id },
    });

    // 4. 환각 검증 (#08) — 모든 응답은 이 게이트 통과 후 학생에게
    const checker = new HallucinationChecker();
    const r_check = await checker.execute({
      question: parsed.data.question,
      response_text: r_answer.output.answer_text,
      source_chunks: sourceChunks,
    });
    totalCost.value += r_check.log.cost_usd;
    await logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/ask",
      userId: user.id,
      tokensIn: r_check.log.tokens_in,
      tokensOut: r_check.log.tokens_out,
      costUsd: r_check.log.cost_usd,
      metadata: { stage: "hallucination_check", studio_job_id: parsed.data.studio_job_id, verdict: r_check.output.verdict },
    });

    const isRejected = r_check.output.verdict === "rejected";
    const finalAnswer = isRejected
      ? `${BLOCKED_RESPONSE}\n\n(차단 사유: ${r_check.output.block_reason ?? "근거 부족"})`
      : r_check.output.verdict === "needs_revision" && r_check.output.suggested_revision
        ? r_check.output.suggested_revision
        : r_answer.output.answer_text;

    // 5. 대화 저장
    let conversationId = parsed.data.conversation_id;
    const userMessage = {
      role: "user" as const,
      content: parsed.data.question,
      timestamp: new Date().toISOString(),
    };
    const assistantMessage = {
      role: "assistant" as const,
      content: finalAnswer,
      verdict: r_check.output.verdict,
      confidence_score: r_check.output.confidence_score,
      sources: sourceChunks.map((c) => ({
        similarity: c.similarity,
        source_type: c.source_type,
        preview: c.chunk_text.slice(0, 200),
      })),
      cost_usd: totalCost.value,
      timestamp: new Date().toISOString(),
    };

    if (conversationId) {
      // 기존 대화에 append
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
            rejected_count:
              (conv.rejected_count ?? 0) + (isRejected ? 1 : 0),
            total_cost_usd: Number(conv.total_cost_usd ?? 0) + totalCost.value,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      }
    } else {
      // 새 대화 생성
      const { data: newConv } = await admin
        .from("tutor_conversations")
        .insert({
          student_id: user.id,
          studio_job_id: parsed.data.studio_job_id,
          messages: [userMessage, assistantMessage],
          total_messages: 2,
          rejected_count: isRejected ? 1 : 0,
          total_cost_usd: totalCost.value,
        })
        .select("id")
        .single();
      conversationId = newConv?.id;
    }

    return NextResponse.json({
      answer: finalAnswer,
      verdict: r_check.output.verdict,
      confidence_score: r_check.output.confidence_score,
      block_reason: r_check.output.block_reason,
      sources: sourceChunks.map((c, i) => ({
        index: i + 1,
        similarity: c.similarity,
        source_type: c.source_type,
        preview: c.chunk_text.slice(0, 200),
      })),
      conversation_id: conversationId,
      cost_usd: totalCost.value,
      cited_chunks: r_answer.output.cited_chunks,
      ai_confidence: r_answer.output.confidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tutor/ask] failed:", err);
    return NextResponse.json(
      { error: "ask_failed", detail: message },
      { status: 500 },
    );
  }
}
