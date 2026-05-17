-- ─────────────────────────────────────────────────────────
-- 0049_g4c_w38.sql
-- W38 Gate G4-C — Phase 4 종료 + Phase 5 진입
-- ─────────────────────────────────────────────────────────

create table if not exists public.g4c_reports (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  phase4_kpi_snapshot jsonb,
  b2c_b2b_breakdown jsonb,
  revenue_vs_plan jsonb,
  org_changes jsonb,
  market_learnings text,
  phase5_recommendations text,
  raw_payload jsonb
);

alter table public.g4c_reports enable row level security;
drop policy if exists "admin manages g4c reports" on public.g4c_reports;
create policy "admin manages g4c reports" on public.g4c_reports
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

create table if not exists public.g4c_decisions (
  id uuid primary key default gen_random_uuid(),
  decision text not null check (decision in ('go','hold','pivot_b2c','pivot_b2b','stop')),
  rationale text not null,
  next_actions text,
  board_meeting_date date,
  spinoff_consideration boolean default false,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  metadata jsonb
);

alter table public.g4c_decisions enable row level security;
drop policy if exists "admin manages g4c decisions" on public.g4c_decisions;
create policy "admin manages g4c decisions" on public.g4c_decisions
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

-- Phase 5 준비
create table if not exists public.phase5_roadmap (
  id uuid primary key default gen_random_uuid(),
  week_label text not null,                 -- 'W1','W2'..'W24' or 'Q1','Q2','Q3','Q4'
  initiative text not null,
  domain text check (domain in ('b2c','b2b','global','infra','org','other')),
  owner_team text,
  estimated_cost_krw bigint,
  status text not null default 'planned' check (status in ('planned','in_progress','done','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_phase5_roadmap_status on public.phase5_roadmap(status, week_label);

alter table public.phase5_roadmap enable row level security;
drop policy if exists "admin manages phase5 roadmap" on public.phase5_roadmap;
create policy "admin manages phase5 roadmap" on public.phase5_roadmap
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

-- Phase 4 최종 회고 (24주 누적)
create table if not exists public.phase4_retrospective (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  went_well text[],
  was_hard text[],
  do_differently text[],
  advice_for_phase5 text,
  unforeseen_outcomes text,                  -- 예상치 못한 결과 (긍정·부정)
  created_at timestamptz not null default now()
);

alter table public.phase4_retrospective enable row level security;
drop policy if exists "tf manages phase4 retro" on public.phase4_retrospective;
create policy "tf manages phase4 retro" on public.phase4_retrospective
  for all to authenticated
  using (
    author_id = auth.uid()
    or public.is_keg_super_admin(auth.uid())
    or public.is_admin_or_ops(auth.uid())
  )
  with check (author_id = auth.uid());

-- Phase 5 시드 (24주 로드맵 골격)
insert into public.phase5_roadmap (week_label, initiative, domain, owner_team, estimated_cost_krw)
values
  ('Q1', 'B2C 모집 가속 (학생 2,000명)', 'b2c', 'B2C팀', 200000000),
  ('Q1', '영업 시니어 입사 + B2B 파이프라인 30개', 'b2b', 'B2B팀', 80000000),
  ('Q1', 'AI 인프라 확장 (학생 5배 대비)', 'infra', '인프라팀', 150000000),
  ('Q2', 'B2C 3,000명 + 신규 과정 5개', 'b2c', 'B2C팀', 250000000),
  ('Q2', 'B2B 케이스 스터디 5건 + 시장 진입', 'b2b', 'B2B팀', 100000000),
  ('Q3', '베트남 시장 진입 (현지 파트너)', 'global', '글로벌 PM', 500000000),
  ('Q3', 'B2C 4,000명 + 디지털 마케팅 확장', 'b2c', 'B2C팀', 300000000),
  ('Q4', 'B2C 5,000명 + B2B 50개사', 'b2c', '사업부장', 200000000),
  ('Q4', '해외 첫 매출 + 차차년도 계획', 'global', '사업부장', 150000000),
  ('Q4', 'Phase 5 종료 회고 + Gate G5', 'org', '사업부장', 20000000)
on conflict do nothing;
