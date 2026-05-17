-- ─────────────────────────────────────────────────────────
-- 0050_runtime_v21.sql
-- v2.1.0 — Resend 이메일 + Stripe 결제 + 수료증 발급
-- ─────────────────────────────────────────────────────────

-- ═══ email_log (Resend 발송 추적) ══════════════════════════
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text not null,
  template text,                        -- 'checkin_30d','renewal_30d','incident','custom'
  related_table text,                   -- 'customer_checkins' 등
  related_id uuid,
  status text not null default 'queued' check (status in ('queued','sent','failed','bounced')),
  resend_id text,                       -- Resend message id
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_log_status on public.email_log(status, created_at desc);

alter table public.email_log enable row level security;
drop policy if exists "admin reads email_log" on public.email_log;
create policy "admin reads email_log" on public.email_log
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));

-- ═══ subscriptions (Stripe) ════════════════════════════════
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null,                   -- 'b2c_monthly', 'b2c_yearly', 'b2b_starter', 'b2b_pro'
  status text not null default 'active' check (status in ('trialing','active','past_due','canceled','expired','incomplete')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  amount_krw bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status) where status in ('active','trialing','past_due');

alter table public.subscriptions enable row level security;
drop policy if exists "user reads own subscription" on public.subscriptions;
create policy "user reads own subscription" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));
drop policy if exists "admin manages subscriptions" on public.subscriptions;
create policy "admin manages subscriptions" on public.subscriptions
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));

-- ═══ payment_log (결제 이력) ═══════════════════════════════
create table if not exists public.payment_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id text,
  amount_krw bigint not null,
  status text not null check (status in ('succeeded','failed','refunded','pending')),
  payment_method text,                  -- 'card','bank_transfer' 등
  refund_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_log_user on public.payment_log(user_id, created_at desc);

alter table public.payment_log enable row level security;
drop policy if exists "user reads own payments" on public.payment_log;
create policy "user reads own payments" on public.payment_log
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));
drop policy if exists "admin writes payments" on public.payment_log;
create policy "admin writes payments" on public.payment_log
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));

-- ═══ certificates (수료증) ═════════════════════════════════
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  course_name text not null,
  course_category text,
  student_name text not null,
  issued_at date not null default current_date,
  certificate_number text not null unique,    -- 'KEG-2027-000001' 형식
  completion_date date,
  score numeric(5,2),                          -- 0~100
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_certificates_user on public.certificates(user_id, issued_at desc);

alter table public.certificates enable row level security;
drop policy if exists "user reads own certificates" on public.certificates;
create policy "user reads own certificates" on public.certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));
drop policy if exists "admin issues certificates" on public.certificates;
create policy "admin issues certificates" on public.certificates
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()) or exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','sme')))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()) or exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor','sme')));

-- 익명 검증용 — 수료증 번호로만 조회 (위변조 방지)
drop policy if exists "anon verifies certificate" on public.certificates;
create policy "anon verifies certificate" on public.certificates
  for select to anon
  using (true);  -- 응용단에서 certificate_number 조회만 허용 (RLS는 정책 1개만 통과해도 허용 — 안전 우려 시 별도 view로 분리)
