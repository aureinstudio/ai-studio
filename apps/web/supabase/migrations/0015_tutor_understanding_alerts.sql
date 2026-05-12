-- 학생 이해도 추적 (#05 ComprehensionEvaluator 출력)
CREATE TABLE IF NOT EXISTS tutor_understanding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_job_id UUID REFERENCES studio_jobs(id) ON DELETE CASCADE,
  source_conversation_id UUID REFERENCES tutor_conversations(id) ON DELETE SET NULL,
  overall_score INT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  by_chapter JSONB,
  weak_concepts JSONB,
  learning_style TEXT,
  recommended_focus JSONB,
  estimated_exam_readiness INT,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  recommendation JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_understanding_student
  ON tutor_understanding(student_id, evaluated_at DESC);

ALTER TABLE tutor_understanding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own understanding" ON tutor_understanding;
CREATE POLICY "Students read own understanding"
  ON tutor_understanding FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admin read all understanding" ON tutor_understanding;
CREATE POLICY "Admin read all understanding"
  ON tutor_understanding FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 안전·관리자 알림 (#09 SafetyDetector 출력)
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'low_engagement', 'frustration', 'content_concern', 'mental_health', 'dropout_risk'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_conversation_id UUID REFERENCES tutor_conversations(id) ON DELETE SET NULL,
  evidence JSONB,
  recommended_intervention TEXT,
  alert_target TEXT NOT NULL CHECK (alert_target IN ('instructor', 'cs', 'admin')),
  dropout_risk_score INT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity
  ON admin_alerts(severity, created_at DESC)
  WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_student
  ON admin_alerts(student_id, created_at DESC);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read alerts" ON admin_alerts;
CREATE POLICY "Admin read alerts"
  ON admin_alerts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin update alerts" ON admin_alerts;
CREATE POLICY "Admin update alerts"
  ON admin_alerts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 본인 알림은 본인도 조회 가능 (학생이 자기 위험 상태 확인)
DROP POLICY IF EXISTS "Students read own alerts" ON admin_alerts;
CREATE POLICY "Students read own alerts"
  ON admin_alerts FOR SELECT
  USING (auth.uid() = student_id AND severity != 'low');
