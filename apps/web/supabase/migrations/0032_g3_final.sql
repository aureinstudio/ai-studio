-- ─────────────────────────────────────────────────────────
-- 0032_g3_final.sql
-- v0.42.0 W14 — Gate G3 종합 평가 + 차년도 의사결정
-- ─────────────────────────────────────────────────────────

-- G3 종합 보고서 스냅샷 (자동 생성 + 영구 보관)
create table if not exists public.g3_reports (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  kpi_snapshot jsonb not null,
  hypothesis_evaluation jsonb,
  category_roi jsonb,
  founder_dependency_trend jsonb,
  incident_stats jsonb,
  qualitative_summary jsonb,
  raw_payload jsonb
);
create index if not exists idx_g3_reports_recent on public.g3_reports(generated_at desc);

alter table public.g3_reports enable row level security;
drop policy if exists "admin reads g3 reports" on public.g3_reports;
create policy "admin reads g3 reports" on public.g3_reports
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 차년도 4-option 분석 결과
create table if not exists public.next_year_options (
  id uuid primary key default gen_random_uuid(),
  option_key text not null check (option_key in ('expand','deepen','saas','stop')),
  investment_krw bigint,
  projected_revenue_12m_krw bigint,
  projected_revenue_24m_krw bigint,
  required_headcount int,
  risk_summary text,
  roi_12m_pct numeric(6,2),
  roi_24m_pct numeric(6,2),
  analysis jsonb,
  updated_at timestamptz not null default now(),
  unique (option_key)
);

alter table public.next_year_options enable row level security;
drop policy if exists "admin manages options" on public.next_year_options;
create policy "admin manages options" on public.next_year_options
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- G3 최종 의사결정 기록
create table if not exists public.g3_decisions (
  id uuid primary key default gen_random_uuid(),
  selected_option text not null check (selected_option in ('expand','deepen','saas','stop')),
  rationale text not null,
  next_quarter_actions text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  metadata jsonb
);

alter table public.g3_decisions enable row level security;
drop policy if exists "admin manages g3 decisions" on public.g3_decisions;
create policy "admin manages g3 decisions" on public.g3_decisions
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- SaaS 사업성 분석
create table if not exists public.saas_assessment (
  id uuid primary key default gen_random_uuid(),
  market_size_institutions int,
  pricing_model jsonb,           -- { per_student, per_course, enterprise }
  competitors jsonb,
  differentiation text,
  go_to_market text,
  estimated_year1_customers int,
  estimated_year1_revenue_krw bigint,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.saas_assessment enable row level security;
drop policy if exists "admin manages saas assessment" on public.saas_assessment;
create policy "admin manages saas assessment" on public.saas_assessment
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 매출 시나리오
create table if not exists public.revenue_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario text not null check (scenario in ('conservative','moderate','aggressive')),
  month_index int not null,            -- 0 ~ 23
  revenue_krw bigint not null default 0,
  cost_krw bigint not null default 0,
  profit_krw bigint generated always as (revenue_krw - cost_krw) stored,
  notes text,
  unique (scenario, month_index)
);
create index if not exists idx_revenue_scenarios_scenario on public.revenue_scenarios(scenario, month_index);

alter table public.revenue_scenarios enable row level security;
drop policy if exists "admin manages revenue scenarios" on public.revenue_scenarios;
create policy "admin manages revenue scenarios" on public.revenue_scenarios
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 14주 종합 회고 (W14 1회성)
create table if not exists public.retrospective_final (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  went_well text[],
  was_hard text[],
  do_differently text[],
  advice_for_successors text,
  created_at timestamptz not null default now()
);

alter table public.retrospective_final enable row level security;
drop policy if exists "tf reads final retrospective" on public.retrospective_final;
create policy "tf reads final retrospective" on public.retrospective_final
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','operations','sme','instructor','creator'))
  );
drop policy if exists "tf writes own retrospective" on public.retrospective_final;
create policy "tf writes own retrospective" on public.retrospective_final
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','operations','sme','instructor','creator'))
  );

-- 학생 데이터 처리 선택 (베타 종료 후)
create table if not exists public.beta_end_data_choices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade unique,
  choice text not null check (choice in ('convert_paid','delete_all','anonymize_only')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.beta_end_data_choices enable row level security;
drop policy if exists "student manages own data choice" on public.beta_end_data_choices;
create policy "student manages own data choice" on public.beta_end_data_choices
  for all to authenticated
  using (student_id = auth.uid() or public.is_admin(auth.uid()))
  with check (student_id = auth.uid() or public.is_admin(auth.uid()));

-- Phase 4 (차년도) 사업 계획서 초안
create table if not exists public.phase4_plans (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid references public.g3_decisions(id) on delete cascade,
  business_plan_md text,
  budget_md text,
  hiring_jds_md text,
  marketing_md text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.phase4_plans enable row level security;
drop policy if exists "admin manages phase4 plans" on public.phase4_plans;
create policy "admin manages phase4 plans" on public.phase4_plans
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
