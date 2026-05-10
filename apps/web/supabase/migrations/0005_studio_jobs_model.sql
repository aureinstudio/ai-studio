-- studio_jobs 테이블에 model 컬럼 추가
-- 기존 행은 'claude-sonnet-4-5' 기본값으로 채움
ALTER TABLE studio_jobs
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5';
