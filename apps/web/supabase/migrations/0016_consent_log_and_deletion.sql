-- 약관 동의 기록 + 계정 삭제 요청
CREATE TABLE IF NOT EXISTS consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'terms_of_service', 'privacy_policy', 'beta_consent', 'marketing'
  )),
  version TEXT NOT NULL,
  agreed BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user
  ON consent_log(user_id, consent_type, consented_at DESC);

ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own consents" ON consent_log;
CREATE POLICY "Users read own consents"
  ON consent_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own consents" ON consent_log;
CREATE POLICY "Users insert own consents"
  ON consent_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin read all consents" ON consent_log;
CREATE POLICY "Admin read all consents"
  ON consent_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 프로필에 계정 삭제 요청 컬럼 추가 (soft delete)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled
  ON profiles(deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;
