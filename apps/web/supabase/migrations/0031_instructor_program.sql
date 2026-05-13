-- ─────────────────────────────────────────────────────────
-- 0031_instructor_program.sql
-- v0.41.0 W13 — 강사 격상 프로그램 (인센티브 + 평가 + 교육 + 커뮤니티)
-- 핵심: ai-studio가 강사를 대체하는 게 아니라 격상.
-- ─────────────────────────────────────────────────────────

-- 강사 KPI 측정 (월간 누적 또는 스냅샷)
create table if not exists public.instructor_metrics (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  metric_type text not null,           -- ai_usage / student_nps / completion_rate / content_review / risk_intervention / score_improvement
  value numeric not null,
  measured_at timestamptz not null default now(),
  period text not null default to_char(now(), 'YYYY-MM'),  -- 월별 집계용
  metadata jsonb
);
create index if not exists idx_instructor_metrics_inst_period on public.instructor_metrics(instructor_id, period, metric_type);

alter table public.instructor_metrics enable row level security;
drop policy if exists "instructor reads own metrics" on public.instructor_metrics;
create policy "instructor reads own metrics" on public.instructor_metrics
  for select to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));
drop policy if exists "admin writes metrics" on public.instructor_metrics;
create policy "admin writes metrics" on public.instructor_metrics
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 인센티브 지급 기록
create table if not exists public.instructor_incentives (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,                -- YYYY-MM
  tier text not null,                  -- basic / excellent / top / content_ip
  amount_krw integer not null default 0,
  bonus_percent numeric(5,2),
  reason text,
  metrics_snapshot jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (instructor_id, period, tier)
);
create index if not exists idx_incentives_period on public.instructor_incentives(period desc);

alter table public.instructor_incentives enable row level security;
drop policy if exists "instructor reads own incentives" on public.instructor_incentives;
create policy "instructor reads own incentives" on public.instructor_incentives
  for select to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));
drop policy if exists "admin writes incentives" on public.instructor_incentives;
create policy "admin writes incentives" on public.instructor_incentives
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 강사 콘텐츠 제안 (SME 검토 후 학생 공개)
create table if not exists public.instructor_content_proposals (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  course_category text not null check (course_category in ('certification','professional','language','hobby','academic')),
  topic text not null,
  outline text,
  status text not null default 'pending' check (status in ('pending','sme_review','approved','rejected','published')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  feedback text,
  created_at timestamptz not null default now()
);
create index if not exists idx_proposals_status on public.instructor_content_proposals(status, created_at desc);

alter table public.instructor_content_proposals enable row level security;
drop policy if exists "instructor manages own proposals" on public.instructor_content_proposals;
create policy "instructor manages own proposals" on public.instructor_content_proposals
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));
drop policy if exists "sme reads pending proposals" on public.instructor_content_proposals;
create policy "sme reads pending proposals" on public.instructor_content_proposals
  for select to authenticated
  using (
    status in ('pending','sme_review')
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('sme','admin'))
  );

-- 강사 NPS (월간 설문)
create table if not exists public.instructor_nps (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,
  efficiency_score int check (efficiency_score between 0 and 10),     -- 강의 효율
  value_elevation_score int check (value_elevation_score between 0 and 10),  -- 본인 가치 격상
  recommend_score int check (recommend_score between 0 and 10),       -- 동료 추천
  comments text,
  created_at timestamptz not null default now(),
  unique (instructor_id, period)
);

alter table public.instructor_nps enable row level security;
drop policy if exists "instructor submits own nps" on public.instructor_nps;
create policy "instructor submits own nps" on public.instructor_nps
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid());

-- 강사 커뮤니티 게시글 (Q&A + 베스트 프랙티스)
create table if not exists public.instructor_community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'qa' check (category in ('qa','best_practice','announcement')),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  reply_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_posts_recent on public.instructor_community_posts(created_at desc);

create table if not exists public.instructor_community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.instructor_community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_replies_post on public.instructor_community_replies(post_id, created_at);

alter table public.instructor_community_posts enable row level security;
alter table public.instructor_community_replies enable row level security;

drop policy if exists "instructor reads community" on public.instructor_community_posts;
create policy "instructor reads community" on public.instructor_community_posts
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','admin','operations','sme'))
  );
drop policy if exists "instructor posts community" on public.instructor_community_posts;
create policy "instructor posts community" on public.instructor_community_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','admin'))
  );

drop policy if exists "instructor reads replies" on public.instructor_community_replies;
create policy "instructor reads replies" on public.instructor_community_replies
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','admin','operations','sme'))
  );
drop policy if exists "instructor posts replies" on public.instructor_community_replies;
create policy "instructor posts replies" on public.instructor_community_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','admin'))
  );

-- 강사 교육 진척
create table if not exists public.instructor_training_progress (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null,            -- m1_understand / m2_studio / m3_tutor / m4_care / m5_review
  completed_at timestamptz not null default now(),
  unique (instructor_id, module_key)
);

alter table public.instructor_training_progress enable row level security;
drop policy if exists "instructor manages own training" on public.instructor_training_progress;
create policy "instructor manages own training" on public.instructor_training_progress
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid());
