import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkStudioContent } from "./chunker";
import { createEmbeddingsBatch } from "./embedder";

export type IndexResult = {
  chunks_indexed: number;
  cost_usd: number;
  duration_ms: number;
};

/**
 * Studio 작업 → RAG 인덱싱.
 *
 * 1. studio_jobs.content 추출
 * 2. 청킹 (curator·planner·planning)
 * 3. 임베딩 생성 (Gemini batch)
 * 4. rag_embeddings 테이블 upsert (기존 임베딩 삭제 후 재생성 — idempotent)
 *
 * 평균: 책 1권 (50~80 청크) ~ 10~30초 + ~$0.01
 */
export async function indexStudioJob(
  admin: SupabaseClient,
  studioJobId: string,
): Promise<IndexResult> {
  const start = Date.now();

  // 1. 콘텐츠 로드
  const { data: job, error } = await admin
    .from("studio_jobs")
    .select("id, content")
    .eq("id", studioJobId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch studio_job: ${error.message}`);
  if (!job?.content) throw new Error("studio_job has no content");

  // 2. 청킹
  const chunks = chunkStudioContent(job.content);
  if (chunks.length === 0) {
    return { chunks_indexed: 0, cost_usd: 0, duration_ms: Date.now() - start };
  }

  // 3. 기존 임베딩 삭제 (idempotent — 재실행 가능)
  await admin.from("rag_embeddings").delete().eq("studio_job_id", studioJobId);

  // 4. 임베딩 생성 (배치)
  const texts = chunks.map((c) => c.text);
  const embeddings = await createEmbeddingsBatch(texts, "RETRIEVAL_DOCUMENT");

  const totalCost = embeddings.reduce((s, e) => s + e.cost_usd, 0);

  // 5. DB 삽입
  const rows = chunks.map((chunk, i) => ({
    studio_job_id: studioJobId,
    source_type: chunk.source_type,
    chunk_text: chunk.text,
    chunk_index: chunk.chunk_index,
    embedding: embeddings[i].vector,
    metadata: chunk.metadata,
  }));

  const { error: insertErr } = await admin.from("rag_embeddings").insert(rows);
  if (insertErr) {
    throw new Error(`Failed to insert embeddings: ${insertErr.message}`);
  }

  return {
    chunks_indexed: rows.length,
    cost_usd: totalCost,
    duration_ms: Date.now() - start,
  };
}
