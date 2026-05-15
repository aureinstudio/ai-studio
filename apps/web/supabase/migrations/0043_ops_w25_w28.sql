-- ─────────────────────────────────────────────────────────
-- 0043_ops_w25_w28.sql
-- 4주 운영 시리즈 (W25 마케팅, W26 B2B, W27 학생 1k, W28 케이스)
--
-- 추가:
--   - marketing_campaigns : 채널·UTM·예산·실적
--   - sales_leads         : B2B 영업 파이프라인 (kanban)
--   - case_studies        : 성공 사례 (B2B 영업 자료)
--   - mrr_snapshots       : 월별 B2B MRR 추적
-- ─────────────────────────────────────────────────────────

-- ═══ marketing_campaigns ═══════════════════════════════════
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  name text not null,
  channel text not null check (channel in ('naver_search','google_search','kakao_ads','facebook_ads','instagram','influencer','keg_offline','organic','other')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  budget_krw bigint not null default 0,
  spend_krw bigint not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  signups int not null default 0,
  paid_conversions int not null default 0,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned','running','paused','completed')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_mkt_campaigns_tenant on public.marketing_campaigns(tenant_id, status);

alter table public.marketing_campaigns enable row level security;
drop policy if exists "admin manages campaigns" on public.marketing_campaigns;
create policy "admin manages campaigns" on public.marketing_campaigns
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  );

-- ═══ sales_leads (B2B 파이프라인) ══════════════════════════
create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text,                          -- 'inbound','outbound','referral','keg_network'
  stage text not null default 'lead'
    check (stage in ('lead','qualified','demo','proposal','negotiation','closed_won','closed_lost')),
  estimated_arr_krw bigint,             -- 연간 예상 매출 (계약 시 ARR)
  next_action text,
  next_action_date date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_leads_tenant_stage on public.sales_leads(tenant_id, stage);
create index if not exists idx_sales_leads_owner on public.sales_leads(owner_user_id);

alter table public.sales_leads enable row level security;
drop policy if exists "admin manages sales_leads" on public.sales_leads;
create policy "admin manages sales_leads" on public.sales_leads
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  );

-- ═══ case_studies (성공 사례 — B2B 영업 자료) ═══════════════
create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  customer_tenant_id uuid references public.tenants(id) on delete set null,
  customer_name text not null,
  industry text,
  headline text not null,
  problem text,
  solution text,
  results jsonb,                        -- {students_enrolled, completion_rate, satisfaction, ...}
  testimonial text,
  testimonial_author text,
  published boolean not null default false,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_studies enable row level security;
drop policy if exists "everyone reads published case studies" on public.case_studies;
create policy "everyone reads published case studies" on public.case_studies
  for select to authenticated
  using (published = true or public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()));
drop policy if exists "admin manages case studies" on public.case_studies;
create policy "admin manages case studies" on public.case_studies
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin_or_ops(auth.uid()));

-- ═══ mrr_snapshots (월별 B2B MRR) ══════════════════════════
create table if not exists public.mrr_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,           -- YYYY-MM
  mrr_usd numeric(12,2) not null default 0,
  mrr_krw bigint not null default 0,
  new_mrr_usd numeric(12,2) not null default 0,
  churn_mrr_usd numeric(12,2) not null default 0,
  active_customers int not null default 0,
  arpu_usd numeric(10,2),
  notes text,
  recorded_at timestamptz not null default now()
);

alter table public.mrr_snapshots enable row level security;
drop policy if exists "super admin reads mrr" on public.mrr_snapshots;
create policy "super admin reads mrr" on public.mrr_snapshots
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));
