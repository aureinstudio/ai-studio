import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceChunk } from "./hallucination-checker";
import { cached, hashKey } from "@/lib/cache";

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
  // 1. RAG 검색 — 임베딩 벡터 hash로 캐시. 같은 질문 재방문 시 DB hit 회피.
  // L2 TTL 10분 — RAG 인덱스는 거의 변경 안 됨(과정 단위 인덱싱 후 정적).
  const ragKey = `rag:${studioJobId}:${matchCount}:${hashKey([queryEmbedding.slice(0, 16).join(",")])}`;
  const rag_results = await cached<SourceChunk[]>(
    ragKey,
    async () => {
      const { data: chunks, error } = await admin.rpc("search_rag", {
        query_embedding: queryEmbedding,
        job_filter: studioJobId,
        match_count: matchCount,
      });
      if (error) {
        console.error("[context-retriever] search_rag failed:", error);
      }
      return (chunks ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => ({
          chunk_text: c.chunk_text,
          similarity: Number(c.similarity ?? 0),
          source_type: c.source_type ?? "unknown",
        }),
      ) as SourceChunk[];
    },
    { l1TtlSec: 60, l2TtlSec: 600 },
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
