-- ─────────────────────────────────────────────────────────
-- 0003_studio_agent_logs.sql
-- 멀티에이전트 체인 지원: agent_logs 컬럼 + 상태 확장
-- ─────────────────────────────────────────────────────────

-- 1. agent_logs 컬럼 추가 (각 단계별 로그 누적)
-- 형식: [
--   { "agent_id": "studio-06", "agent_name": "핵심 자료 큐레이터",
--     "status": "completed", "started_at": "...", "completed_at": "...",
--     "duration_ms": 12345, "tokens_in": 412, "tokens_out": 1856, "cost_usd": 0.0287 }
-- ]
alter table public.studio_jobs
  add column if not exists agent_logs jsonb default '[]'::jsonb;

-- 2. 상태 enum 확장 — 기존 'completed' 유지 + 'running'은 이미 허용됨
-- (이미 마이그레이션 0002에 check 제약: pending/running/completed/failed)

-- 3. content 컬럼은 이제 { curator: {...}, planner: {...} } 형태로 저장
-- (구조 강제 안 함, 애플리케이션 레벨에서 처리)

-- 4. 인덱스 — agent_logs는 jsonb이므로 GIN
create index if not exists studio_jobs_agent_logs_gin
  on public.studio_jobs using gin(agent_logs);

-- 검증 (실행 후 주석 해제)
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'studio_jobs'
-- order by ordinal_position;
