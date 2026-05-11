-- 사용자가 HeyGen에 업로드한 talking_photo avatar 추적
CREATE TABLE IF NOT EXISTS user_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  heygen_talking_photo_id TEXT NOT NULL,
  label TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  source_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_avatars_user ON user_avatars(user_id, created_at DESC);

ALTER TABLE user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own avatars"
  ON user_avatars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatars"
  ON user_avatars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own avatars"
  ON user_avatars FOR UPDATE
  USING (auth.uid() = user_id);

-- 업로드 사진 원본 저장 버킷 (선택 — 본부장이 참고용으로 보고 싶을 때)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatar-sources', 'user-avatar-sources', false)
ON CONFLICT (id) DO NOTHING;

-- 본인 사진만 접근
DROP POLICY IF EXISTS "Users can read own avatar sources" ON storage.objects;
CREATE POLICY "Users can read own avatar sources"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatar-sources' AND (storage.foldername(name))[1] = auth.uid()::text);
