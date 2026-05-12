import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceChunk } from "./hallucination-checker";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ContextResult = {
  rag_results: SourceChunk[];
  conversation_summary: string;
};

/**
 * Tutor #02 — 컨텍스트 검색 (LLM 미사용, 순수 함수).
 *
 * 책임:
 *   - RAG search SQL 함수 호출
 *   - 이전 대화에서 최근 3~5턴 요약 (LLM 없이 단순 truncation)
 *
 * student_progress·weak_areas는 quiz·진도 테이블 미존재 — Phase 3에서 추가.
 */
export async function retrieveContext(
  admin: SupabaseClient,
  studioJobId: string,
  queryEmbedding: number[],
  conversationId: string | null,
  matchCount: number = 5,
): Promise<ContextResult> {
  // 1. RAG 검색
  const { data: chunks, error } = await admin.rpc("search_rag", {
    query_embedding: queryEmbedding,
    job_filter: studioJobId,
    match_count: matchCount,
  });
  if (error) {
    console.error("[context-retriever] search_rag failed:", error);
  }
  const rag_results: SourceChunk[] = (chunks ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => ({
      chunk_text: c.chunk_text,
      similarity: Number(c.similarity ?? 0),
      source_type: c.source_type ?? "unknown",
    }),
  );

  // 2. 대화 요약 (최근 3턴, 단순 truncation)
  let conversation_summary = "";
  if (conversationId) {
    const { data: conv } = await admin
      .from("tutor_conversations")
      .select("messages")
      .eq("id", conversationId)
      .maybeSingle();
    const messages = ((conv?.messages ?? []) as ConversationMessage[]).slice(-6); // 최근 3쌍
    if (messages.length > 0) {
      conversation_summary = messages
        .map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content.slice(0, 150)}`)
        .join(" / ");
    }
  }

  return { rag_results, conversation_summary };
}
