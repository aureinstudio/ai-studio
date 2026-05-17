-- ─────────────────────────────────────────────────────────
-- 0045_org_w31.sql
-- W31 조직 분리 — ai-studio 사업부 신설
--
-- 추가:
--   - departments      : 사업부·팀 구조
--   - team_members     : 팀원 배정 (profile → team mapping)
--   - team_kpis        : 팀별 월간 KPI 스냅샷
--   - pnl_snapshots    : 월간 P&L (revenue · cost · profit)
--   - hires            : 채용 파이프라인 (instructor_recruitment 범용화)
-- ─────────────────────────────────────────────────────────

-- ═══ departments ══════════════════════════════════════════
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  name text not null,
  slug text not null,
  parent_id uuid references public.departments(id) on delete cascade,
  team_type text check (team_type in ('division','b2c','b2b','infra','other')),
  head_user_id uuid references public.profiles(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table public.departments enable row level security;
drop policy if exists "admin manages departments" on public.departments;
create policy "admin manages departments" on public.departments
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  );

-- ai-studio 사업부 시드
insert into public.departments (id, name, slug, team_type, description)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'ai-studio 사업부', 'ai-studio', 'division', 'KEG 사내 분리 사업부')
on conflict (tenant_id, slug) do nothing;

insert into public.departments (id, name, slug, parent_id, team_type, description)
values
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'B2C팀', 'b2c-team', 'a0000000-0000-0000-0000-000000000001'::uuid, 'b2c', '콘텐츠·운영·마케팅 — 3명'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'B2B팀', 'b2b-team', 'a0000000-0000-0000-0000-000000000001'::uuid, 'b2b', '영업·CSM·통합·기술 — 4명'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, '공통 인프라팀', 'infra-team', 'a0000000-0000-0000-0000-000000000001'::uuid, 'infra', 'AI 엔지니어·DevOps·보안 — 3명')
on conflict (tenant_id, slug) do nothing;

-- ═══ team_members ═════════════════════════════════════════
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position text,
  joined_at date not null default current_date,
  left_at date,
  unique (department_id, user_id)
);
create index if not exists idx_team_members_dept on public.team_members(department_id) where left_at is null;
create index if not exists idx_team_members_user on public.team_members(user_id);

alter table public.team_members enable row level security;
drop policy if exists "admin manages team_members" on public.team_members;
create policy "admin manages team_members" on public.team_members
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()));

-- ═══ team_kpis (월간 스냅샷) ══════════════════════════════
create table if not exists public.team_kpis (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  period text not null,                  -- YYYY-MM
  metric_key text not null,
  metric_value numeric not null,
  target_value numeric,
  notes text,
  recorded_at timestamptz not null default now(),
  unique (department_id, period, metric_key)
);

alter table public.team_kpis enable row level security;
drop policy if exists "admin manages team_kpis" on public.team_kpis;
create policy "admin manages team_kpis" on public.team_kpis
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()));

-- ═══ pnl_snapshots (월간 P&L) ═════════════════════════════
create table if not exists public.pnl_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  period text not null,
  b2c_revenue_krw bigint not null default 0,
  b2b_revenue_krw bigint not null default 0,
  ai_cost_krw bigint not null default 0,        -- Anthropic/HeyGen/Gemini 등
  personnel_cost_krw bigint not null default 0,
  marketing_cost_krw bigint not null default 0,
  infra_cost_krw bigint not null default 0,
  other_cost_krw bigint not null default 0,
  total_revenue_krw bigint generated always as (b2c_revenue_krw + b2b_revenue_krw) stored,
  total_cost_krw bigint generated always as (ai_cost_krw + personnel_cost_krw + marketing_cost_krw + infra_cost_krw + other_cost_krw) stored,
  notes text,
  recorded_at timestamptz not null default now(),
  unique (tenant_id, period)
);
create index if not exists idx_pnl_period on public.pnl_snapshots(period desc);

alter table public.pnl_snapshots enable row level security;
drop policy if exists "admin manages pnl" on public.pnl_snapshots;
create policy "admin manages pnl" on public.pnl_snapshots
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

-- ═══ hires (전체 채용 파이프라인) ══════════════════════════
create table if not exists public.hires (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  candidate_name text not null,
  candidate_email text,
  role text not null,                          -- 'sales','csm','devops','designer','engineer','instructor', ...
  target_department_id uuid references public.departments(id) on delete set null,
  source text,                                 -- 'referral','job_post','direct','headhunter'
  stage text not null default 'sourcing'
    check (stage in ('sourcing','screening','interview','offer','onboarded','rejected','withdrew')),
  expected_salary_krw bigint,
  notes text,
  next_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hires_stage on public.hires(stage, created_at desc);

alter table public.hires enable row level security;
drop policy if exists "admin manages hires" on public.hires;
create policy "admin manages hires" on public.hires
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()));

-- W31 채용 4건 시드 (요청된 인력)
insert into public.hires (candidate_name, role, target_department_id, stage, notes)
values
  ('TBD — 영업 시니어', 'sales', 'a0000000-0000-0000-0000-000000000003'::uuid, 'sourcing', 'B2B 경험 5년+. JD 작성 필요'),
  ('TBD — CSM', 'csm', 'a0000000-0000-0000-0000-000000000003'::uuid, 'sourcing', '고객 성공 매니저. SaaS 경험 우대'),
  ('TBD — DevOps', 'devops', 'a0000000-0000-0000-0000-000000000004'::uuid, 'sourcing', 'Production 운영. Vercel·Supabase 경험'),
  ('TBD — 디자이너', 'designer', 'a0000000-0000-0000-0000-000000000002'::uuid, 'sourcing', '브랜드·마케팅. 교육 도메인 우대')
on conflict do nothing;
