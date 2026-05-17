-- ─────────────────────────────────────────────────────────
-- 0044_g4b_gate.sql
-- W29-W30 Gate G4-B — Phase 4B 완료 검증 + Phase 4C 진입 결정
--
-- 추가:
--   - g4b_reports          : 게이트 평가 스냅샷
--   - g4b_decisions        : 통과/보강/실패 결정
--   - customer_checkins    : 30/60/90일 자동 체크인 기록
--   - renewal_alerts       : 계약 만료 30일 전 알림
-- ─────────────────────────────────────────────────────────

create table if not exists public.g4b_reports (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  b2c_students int,
  b2b_customers int,
  b2c_nps int,
  b2b_nps int,
  revenue_krw bigint,
  incidents_l3_plus int,
  gate_status text check (gate_status in ('pass','partial','fail')),
  raw_payload jsonb
);

alter table public.g4b_reports enable row level security;
drop policy if exists "admin reads g4b reports" on public.g4b_reports;
create policy "admin reads g4b reports" on public.g4b_reports
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

create table if not exists public.g4b_decisions (
  id uuid primary key default gen_random_uuid(),
  decision text not null check (decision in ('pass_to_phase4c','reinforce_2w','fail')),
  rationale text not null,
  next_actions text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  metadata jsonb
);

alter table public.g4b_decisions enable row level security;
drop policy if exists "admin manages g4b decisions" on public.g4b_decisions;
create policy "admin manages g4b decisions" on public.g4b_decisions
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

create table if not exists public.customer_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_type text not null check (checkin_type in ('day_30','day_60','day_90','low_usage','renewal')),
  status text not null default 'sent' check (status in ('sent','completed','skipped','failed')),
  message text,
  metadata jsonb,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  unique (user_id, checkin_type)
);
create index if not exists idx_customer_checkins_scheduled on public.customer_checkins(scheduled_for) where status = 'sent' and sent_at is null;

alter table public.customer_checkins enable row level security;
drop policy if exists "admin reads checkins" on public.customer_checkins;
create policy "admin reads checkins" on public.customer_checkins
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));

create table if not exists public.renewal_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_end_date date not null,
  days_to_renewal int not null,
  alert_level text not null check (alert_level in ('30d','14d','7d','overdue')),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_renewal_alerts_open on public.renewal_alerts(alert_level, created_at desc) where acknowledged_at is null;

alter table public.renewal_alerts enable row level security;
drop policy if exists "admin reads renewal alerts" on public.renewal_alerts;
create policy "admin reads renewal alerts" on public.renewal_alerts
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));
