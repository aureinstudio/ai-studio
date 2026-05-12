-- Cast 작업 품질 점수 저장
ALTER TABLE cast_jobs
  ADD COLUMN IF NOT EXISTS quality_score JSONB,
  ADD COLUMN IF NOT EXISTS retry_count SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cast_jobs_quality_pass
  ON cast_jobs((quality_score->>'overall_pass'));
