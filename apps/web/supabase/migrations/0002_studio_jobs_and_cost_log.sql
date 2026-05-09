-- ─────────────────────────────────────────────────────────
-- 0002_studio_jobs_and_cost_log.sql
-- Studio 작업 결과 + LLM API 비용 로그 테이블 + RLS
-- ─────────────────────────────────────────────────────────

-- 1. studio_jobs — Claude 호출 1건 = row 1개
create table if not exists public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  length text not null check (length in ('short', 'medium', 'long')),
  content jsonb,                                                   -- Claude 응답 JSON
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  cost_usd numeric(10, 6),
  duration_seconds numeric(10, 3),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists studio_jobs_user_idx on public.studio_jobs(user_id, created_at desc);
create index if not exists studio_jobs_status_idx on public.studio_jobs(status);

alter table public.studio_jobs enable row level security;

drop policy if exists "Users view own studio_jobs" on public.studio_jobs;
create policy "Users view own studio_jobs"
  on public.studio_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own studio_jobs" on public.studio_jobs;
create policy "Users insert own studio_jobs"
  on public.studio_jobs for insert
  with check (auth.uid() = user_id);

-- (선택) admin은 모든 studio_jobs 조회 가능 — KPI·비용 분석 대시보드용
drop policy if exists "Admins view all studio_jobs" on public.studio_jobs;
create policy "Admins view all studio_jobs"
  on public.studio_jobs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 2. cost_log — 모든 LLM·외부 API 호출의 비용 집계
create table if not exists public.cost_log (
  id uuid primary key default gen_random_uuid(),
  service text not null,                                           -- 'anthropic' | 'openai' | 'elevenlabs' | ...
  endpoint text not null,                                          -- '/studio/generate' | ...
  user_id uuid references auth.users(id) on delete set null,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 6) not null,
  metadata jsonb,                                                  -- 모델명·request_id·라우팅 힌트 등
  created_at timestamptz not null default now()
);

create index if not exists cost_log_user_created_idx on public.cost_log(user_id, created_at desc);
create index if not exists cost_log_service_created_idx on public.cost_log(service, created_at desc);

alter table public.cost_log enable row level security;

-- 본인 비용만 조회
drop policy if exists "Users view own cost_log" on public.cost_log;
create policy "Users view own cost_log"
  on public.cost_log for select
  using (auth.uid() = user_id);

-- admin은 전체 조회 (전사 비용 모니터링)
drop policy if exists "Admins view all cost_log" on public.cost_log;
create policy "Admins view all cost_log"
  on public.cost_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 인증된 사용자가 본인 행 insert 가능 (API 라우트가 사용자 컨텍스트로 호출)
drop policy if exists "Users insert own cost_log" on public.cost_log;
create policy "Users insert own cost_log"
  on public.cost_log for insert
  with check (auth.uid() = user_id);

-- 검증 쿼리 (실행 후 수동, 주석 해제해서 실행)
-- select count(*) from public.studio_jobs;     -- 0
-- select count(*) from public.cost_log;        -- 0
-- select tablename, rowsecurity from pg_tables where tablename in ('studio_jobs', 'cost_log');
