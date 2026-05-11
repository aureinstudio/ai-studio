-- Cast Storage 버킷 (Supabase Storage)
-- 음성·영상·자막 파일 저장. 공개 읽기 (URL 공유 가능), 인증된 쓰기.

-- 버킷 생성 (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cast-audio', 'cast-audio', true),
  ('cast-video', 'cast-video', true),
  ('cast-captions', 'cast-captions', true)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책 (URL 공유 가능)
DROP POLICY IF EXISTS "Public read cast audio" ON storage.objects;
CREATE POLICY "Public read cast audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cast-audio');

DROP POLICY IF EXISTS "Public read cast video" ON storage.objects;
CREATE POLICY "Public read cast video"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cast-video');

DROP POLICY IF EXISTS "Public read cast captions" ON storage.objects;
CREATE POLICY "Public read cast captions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cast-captions');

-- 쓰기는 service-role만 (백엔드에서만 업로드)
-- service-role은 RLS 우회하므로 별도 정책 불필요.
-- 인증된 사용자의 직접 업로드는 차단 (오케스트레이터만 업로드)
