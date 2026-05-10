-- studio_jobs.is_sample: 공개 샘플 플래그 (SME 검토용)
ALTER TABLE studio_jobs
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_label TEXT;

-- 공개 샘플 jobs는 누구나 읽기 가능 (인증 불필요)
CREATE POLICY "Public can read sample jobs"
  ON studio_jobs
  FOR SELECT
  USING (is_sample = TRUE AND deleted_at IS NULL);

-- SME (시니어 강사) 평가 테이블
CREATE TABLE IF NOT EXISTS sme_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_job_id UUID NOT NULL REFERENCES studio_jobs(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  improvements TEXT,
  evaluator_name TEXT,
  evaluator_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sme_evaluations_studio_job_id_idx
  ON sme_evaluations(studio_job_id);

ALTER TABLE sme_evaluations ENABLE ROW LEVEL SECURITY;

-- 누구나 평가 제출 가능 (익명 허용 — SME가 로그인 없이 평가)
CREATE POLICY "Anyone can submit SME evaluation"
  ON sme_evaluations
  FOR INSERT
  WITH CHECK (TRUE);

-- 샘플 job에 대한 평가는 누구나 읽기 가능
CREATE POLICY "Anyone can read sample evaluations"
  ON sme_evaluations
  FOR SELECT
  USING (
    studio_job_id IN (SELECT id FROM studio_jobs WHERE is_sample = TRUE)
  );

-- admin은 모든 평가 읽기 가능 (대시보드 집계용)
CREATE POLICY "Admin can read all evaluations"
  ON sme_evaluations
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
