-- HeyGen 비동기 워크플로 — webhook 기반
-- 폴링 제거: 영상 제출 후 즉시 종료, webhook이 완료 알림

ALTER TABLE cast_jobs
  ADD COLUMN IF NOT EXISTS heygen_video_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cast_jobs_heygen_video
  ON cast_jobs(heygen_video_id);

-- status에 'rendering' 추가 (영상 제출 후 webhook 대기 상태)
ALTER TABLE cast_jobs DROP CONSTRAINT IF EXISTS cast_jobs_status_check;
ALTER TABLE cast_jobs
  ADD CONSTRAINT cast_jobs_status_check
  CHECK (status IN ('pending', 'running', 'rendering', 'completed', 'failed'));

-- webhook 콜백 받을 때 service-role로 쓰기 가능 (RLS 우회 — service-role이 이미 우회함)
