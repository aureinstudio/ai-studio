-- pgvector 확장 + RAG 임베딩 저장소
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_job_id UUID NOT NULL REFERENCES studio_jobs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('curator', 'planner', 'planning', 'example')),
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_studio_job ON rag_embeddings(studio_job_id);
-- HNSW: 코사인 유사도 최적
CREATE INDEX IF NOT EXISTS idx_rag_hnsw
  ON rag_embeddings
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE rag_embeddings ENABLE ROW LEVEL SECURITY;

-- 본인 작업의 임베딩만 읽기 (또는 공개 샘플)
DROP POLICY IF EXISTS "Users read embeddings of own or sample jobs" ON rag_embeddings;
CREATE POLICY "Users read embeddings of own or sample jobs"
  ON rag_embeddings FOR SELECT
  USING (
    studio_job_id IN (
      SELECT id FROM studio_jobs
      WHERE user_id = auth.uid() OR is_sample = TRUE
    )
  );

-- 검색 함수 (코사인 유사도, 본인·샘플 작업만)
CREATE OR REPLACE FUNCTION search_rag(
  query_embedding vector(1536),
  job_filter UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB,
  source_type TEXT,
  chunk_index INT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    re.id,
    re.chunk_text,
    1 - (re.embedding <=> query_embedding) AS similarity,
    re.metadata,
    re.source_type,
    re.chunk_index
  FROM rag_embeddings re
  WHERE re.studio_job_id = job_filter
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;
