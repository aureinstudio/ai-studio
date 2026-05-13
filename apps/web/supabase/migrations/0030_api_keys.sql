-- ─────────────────────────────────────────────────────────
-- 0030_api_keys.sql
-- v0.40.0 — B2B API key infrastructure (Phase 1 commercialization)
-- KEG admin이 외부 고객사에 키 발급. 데이터는 owner_user_id 기준 격리.
-- Phase 2 (v0.50.0+) 에서 organizations 테이블로 완전 multi-tenant 전환 예정.
-- ─────────────────────────────────────────────────────────

-- 'customer' 역할 추가 — API 키 발급 대상 사용자
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'sme', 'instructor', 'operations', 'creator', 'customer'));

-- api_keys 테이블
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_prefix text not null,                          -- ak_live_xxxxxxxx (앞 12자 표시용)
  key_hash text not null unique,                     -- sha256 hex
  scopes jsonb not null default '["studio","cast","tutor"]'::jsonb,
  rate_limit_per_min int not null default 60,
  monthly_cost_cap_usd numeric(10,2) not null default 100.00,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_api_keys_prefix on public.api_keys(key_prefix) where revoked_at is null;
create index if not exists idx_api_keys_owner on public.api_keys(owner_user_id);

-- RLS
alter table public.api_keys enable row level security;

drop policy if exists "admin manages api_keys" on public.api_keys;
create policy "admin manages api_keys" on public.api_keys
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "owner reads own api_keys" on public.api_keys;
create policy "owner reads own api_keys" on public.api_keys
  for select to authenticated
  using (owner_user_id = auth.uid());

-- 호출 로그 (rate limit + 비용 추적용)
create table if not exists public.api_key_usage (
  id bigserial primary key,
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  endpoint text not null,
  status_code int,
  cost_usd numeric(10,4) default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_key_usage_key_time on public.api_key_usage(api_key_id, created_at desc);

alter table public.api_key_usage enable row level security;

drop policy if exists "admin reads api_key_usage" on public.api_key_usage;
create policy "admin reads api_key_usage" on public.api_key_usage
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "owner reads own api_key_usage" on public.api_key_usage;
create policy "owner reads own api_key_usage" on public.api_key_usage
  for select to authenticated
  using (
    exists (
      select 1 from public.api_keys k
      where k.id = api_key_usage.api_key_id and k.owner_user_id = auth.uid()
    )
  );
