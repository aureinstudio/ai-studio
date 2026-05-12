-- Tutor 대화 저장
CREATE TABLE IF NOT EXISTS tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_job_id UUID NOT NULL REFERENCES studio_jobs(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_messages INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  understanding_score INT,
  language TEXT NOT NULL DEFAULT 'ko',
  total_cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tutor_conv_student
  ON tutor_conversations(student_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_conv_job
  ON tutor_conversations(studio_job_id);

ALTER TABLE tutor_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own conversations" ON tutor_conversations;
CREATE POLICY "Students read own conversations"
  ON tutor_conversations FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own conversations" ON tutor_conversations;
CREATE POLICY "Students insert own conversations"
  ON tutor_conversations FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students update own conversations" ON tutor_conversations;
CREATE POLICY "Students update own conversations"
  ON tutor_conversations FOR UPDATE
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admin read all conversations" ON tutor_conversations;
CREATE POLICY "Admin read all conversations"
  ON tutor_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
