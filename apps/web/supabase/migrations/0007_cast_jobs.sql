-- Cast jobs (Studio → Video 변환)
CREATE TABLE IF NOT EXISTS cast_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_job_id UUID REFERENCES studio_jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('batch', 'realtime')) DEFAULT 'batch',
  input_slides JSONB,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  agent_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  duration_seconds INT,
  video_url TEXT,
  captions_url TEXT,
  error_message TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_cost_usd NUMERIC(10, 4),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cast_jobs_user ON cast_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cast_jobs_studio ON cast_jobs(studio_job_id);

ALTER TABLE cast_jobs ENABLE ROW LEVEL SECURITY;

-- 본인 작업만 조회·수정 가능
CREATE POLICY "Users can read own cast jobs"
  ON cast_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cast jobs"
  ON cast_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cast jobs"
  ON cast_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- admin은 모든 작업 조회
CREATE POLICY "Admin can read all cast jobs"
  ON cast_jobs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
