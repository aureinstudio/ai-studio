-- ─────────────────────────────────────────────────────────
-- 0048_annual_plan_w37.sql
-- W37 차년도 사업 계획서
-- ─────────────────────────────────────────────────────────

create table if not exists public.annual_plans (
  id uuid primary key default gen_random_uuid(),
  target_year int not null,
  status text not null default 'draft' check (status in ('draft','submitted','approved','executing','completed')),

  -- 목표 (정량)
  target_b2c_students int,
  target_b2c_courses int,
  target_b2b_customers int,
  target_b2b_mrr_krw bigint,
  target_revenue_krw bigint,
  target_profit_krw bigint,
  target_headcount int,
  target_global_countries jsonb default '[]'::jsonb,

  -- 예산 (KRW)
  budget_revenue_krw bigint,
  budget_personnel_krw bigint,
  budget_infra_krw bigint,
  budget_marketing_krw bigint,
  budget_other_krw bigint,

  -- 자유 서술
  market_analysis text,
  org_plan text,
  milestones text,
  risks text,
  decision_gates text,

  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_year)
);

alter table public.annual_plans enable row level security;
drop policy if exists "admin manages annual_plans" on public.annual_plans;
create policy "admin manages annual_plans" on public.annual_plans
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

create table if not exists public.quarterly_targets (
  id uuid primary key default gen_random_uuid(),
  annual_plan_id uuid not null references public.annual_plans(id) on delete cascade,
  quarter text not null check (quarter in ('Q1','Q2','Q3','Q4')),
  b2c_students int,
  b2b_customers int,
  revenue_krw bigint,
  milestone text,
  unique (annual_plan_id, quarter)
);

alter table public.quarterly_targets enable row level security;
drop policy if exists "admin manages quarterly_targets" on public.quarterly_targets;
create policy "admin manages quarterly_targets" on public.quarterly_targets
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

-- W37 차년도 시드 (2027년 가정)
insert into public.annual_plans (
  target_year, status,
  target_b2c_students, target_b2c_courses,
  target_b2b_customers, target_b2b_mrr_krw,
  target_revenue_krw, target_profit_krw, target_headcount,
  target_global_countries,
  budget_revenue_krw, budget_personnel_krw, budget_infra_krw, budget_marketing_krw, budget_other_krw,
  market_analysis, org_plan, milestones, risks, decision_gates
)
values (
  2027, 'draft',
  5000, 20,
  50, 50000000,
  5000000000, 1500000000, 25,
  '["VN"]'::jsonb,
  5000000000, 2000000000, 500000000, 700000000, 300000000,
  'B2C: 한국 자격증·직무·언어 시장 확장. 학생 1,000→5,000명 5x. B2B: KEG 네트워크 + 직접 영업으로 5→50개사. 글로벌: 베트남 1국 시범 진출 (W35 검토 권장 순서 1번).',
  '11명→25명. B2C팀(콘텐츠·운영·마케팅) 6명, B2B팀(영업·CSM·통합·기술) 10명, 인프라팀(AI·DevOps·보안) 6명, 사업부장 1, 글로벌 PM 2.',
  'Q1: B2C 2,000·B2B 20 / Q2: B2C 3,000·B2B 30 / Q3: B2C 4,000·B2B 40·글로벌 진입 / Q4: B2C 5,000·B2B 50·해외 첫 매출.',
  '인력 채용 지연 (특히 영업·시니어). AI 비용 급증 (학생 5x). 베트남 법무·결제 변수. 경쟁사 진입.',
  'Q2 게이트: B2C 3,000+B2B 30 미달 시 글로벌 진출 보류. Q3 게이트: 베트남 진입 가능성 재평가. Q4 게이트: 차차년도 계획 (다국가 확장 vs 안정화).'
)
on conflict (target_year) do nothing;

-- 분기별 목표 시드
insert into public.quarterly_targets (annual_plan_id, quarter, b2c_students, b2b_customers, revenue_krw, milestone)
select id, q.quarter, q.students, q.b2b, q.revenue, q.milestone
from public.annual_plans, (
  values
    ('Q1', 2000, 20, 800000000, 'B2C 모집 가속 · 영업 시니어 입사'),
    ('Q2', 3000, 30, 1200000000, '디지털 마케팅 확장 · B2B 케이스 5건'),
    ('Q3', 4000, 40, 1500000000, '베트남 시장 진입 (현지 파트너 1개사)'),
    ('Q4', 5000, 50, 1500000000, '해외 첫 매출 · 차차년도 계획 확정')
) as q(quarter, students, b2b, revenue, milestone)
where target_year = 2027
on conflict (annual_plan_id, quarter) do nothing;
