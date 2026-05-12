-- ─────────────────────────────────────────────────────────
-- 0022_g2_kpi.sql
-- v0.31.0 — Gate G2 KPI 측정 + SME·NPS·강사 활용도 추적
-- ─────────────────────────────────────────────────────────

-- 1. profiles.role 'sme' 추가 (기존 'user', 'admin' 외)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'sme', 'instructor'));

-- 2. hypothesis_metrics — 5개 가설 KPI 시계열
create table if not exists public.hypothesis_metrics (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id text not null check (hypothesis_id in ('H1', 'H2', 'H3', 'H4', 'H5')),
  metric_name text not null,
  value numeric(12, 4),
  sample_size integer,
  measurement_window text not null default 'daily'
    check (measurement_window in ('daily', 'weekly', 'monthly')),
  passed boolean,                                       -- 목표 도달 여부
  metadata jsonb,
  measured_at timestamptz not null default now()
);
create index if not exists hypothesis_metrics_h_date_idx
  on public.hypothesis_metrics(hypothesis_id, measured_at desc);

alter table public.hypothesis_metrics enable row level security;
drop policy if exists "Admins view hypothesis_metrics" on public.hypothesis_metrics;
create policy "Admins view hypothesis_metrics"
  on public.hypothesis_metrics for select
  using (public.is_admin(auth.uid()));

-- 3. nps_responses — 학생 NPS 설문
create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 10),
  reason text,
  segment text,                                         -- 'ko' | 'multilingual' (다국어 학생 분리)
  asked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, date_trunc('week', created_at))      -- 주 1회
);
create index if not exists nps_responses_created_idx
  on public.nps_responses(created_at desc);
create index if not exists nps_responses_segment_idx
  on public.nps_responses(segment, created_at desc);

alter table public.nps_responses enable row level security;
drop policy if exists "Students manage own nps" on public.nps_responses;
create policy "Students manage own nps"
  on public.nps_responses for all
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id);

-- 4. instructor_usage_reports — 강사 주간 자가 보고 (H3)
create table if not exists public.instructor_usage_reports (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references auth.users(id) on delete set null,
  instructor_name text,                                 -- 익명 입력 허용 (베타 단계)
  week_iso text not null,
  used_studio_content boolean not null,                 -- 강의에 AI 콘텐츠 활용 여부
  content_count integer default 0,                      -- 활용한 콘텐츠 수
  utility_rating integer check (utility_rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);
create index if not exists instructor_usage_week_idx
  on public.instructor_usage_reports(week_iso, created_at desc);

alter table public.instructor_usage_reports enable row level security;
drop policy if exists "Admins view instructor_usage" on public.instructor_usage_reports;
create policy "Admins view instructor_usage"
  on public.instructor_usage_reports for select
  using (public.is_admin(auth.uid()));
drop policy if exists "Instructors insert own report" on public.instructor_usage_reports;
create policy "Instructors insert own report"
  on public.instructor_usage_reports for insert
  with check (
    auth.uid() = instructor_id
    or instructor_id is null  -- 익명 베타 모드 허용 (form에서 IP rate limit 적용)
  );

-- 5. sme_review_assignments — SME에게 검토 할당 (선택, 추적용)
create table if not exists public.sme_review_assignments (
  id uuid primary key default gen_random_uuid(),
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  sme_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'declined')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(studio_job_id, sme_id)
);
create index if not exists sme_assignments_status_idx
  on public.sme_review_assignments(status, requested_at desc);

alter table public.sme_review_assignments enable row level security;
drop policy if exists "SMEs see own assignments" on public.sme_review_assignments;
create policy "SMEs see own assignments"
  on public.sme_review_assignments for select
  using (
    auth.uid() = sme_id
    or public.is_admin(auth.uid())
  );

-- 6. sme_evaluations 보강 — 3축 평가 (기존 rating 외)
alter table public.sme_evaluations
  add column if not exists accuracy_score smallint check (accuracy_score between 1 and 5),
  add column if not exists suitability_score smallint check (suitability_score between 1 and 5),
  add column if not exists exam_alignment_score smallint check (exam_alignment_score between 1 and 5),
  add column if not exists evaluator_id uuid references auth.users(id) on delete set null;
