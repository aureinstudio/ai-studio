-- Studio PPTX export 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-pptx', 'studio-pptx', true)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책 (다운로드 가능)
DROP POLICY IF EXISTS "Public read studio pptx" ON storage.objects;
CREATE POLICY "Public read studio pptx"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'studio-pptx');
