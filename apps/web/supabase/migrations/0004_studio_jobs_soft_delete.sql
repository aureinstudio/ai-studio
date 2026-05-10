-- ─────────────────────────────────────────────────────────
-- 0004_studio_jobs_soft_delete.sql
-- studio_jobs soft delete + UPDATE RLS 정책
-- ─────────────────────────────────────────────────────────

-- 1. soft delete 컬럼
alter table public.studio_jobs
  add column if not exists deleted_at timestamptz;

-- 2. 인덱스 — 대부분 쿼리가 deleted_at IS NULL 필터링하므로 부분 인덱스로 최적화
create index if not exists studio_jobs_user_active_idx
  on public.studio_jobs(user_id, created_at desc)
  where deleted_at is null;

-- 3. UPDATE RLS — 사용자가 본인 row를 (소프트) 수정 가능
-- 기존엔 INSERT·SELECT만 있었음. soft delete = UPDATE deleted_at
drop policy if exists "Users update own studio_jobs" on public.studio_jobs;
create policy "Users update own studio_jobs"
  on public.studio_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 검증 (실행 후 주석 해제)
-- select column_name from information_schema.columns
-- where table_name='studio_jobs' and column_name='deleted_at';
