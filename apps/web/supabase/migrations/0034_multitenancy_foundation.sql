-- ─────────────────────────────────────────────────────────
-- 0034_multitenancy_foundation.sql
-- Phase 4 PR-1 — Multi-tenancy 기반 (RLS 미변경, 기존 동작 100% 유지)
--
-- 이 마이그레이션은 의도적으로 BACKWARD COMPATIBLE:
--   - tenant_id 컬럼은 NULL 허용 (NOT NULL은 PR-2에서)
--   - 기존 RLS 정책 변경 없음 (재작성은 PR-3에서)
--   - 새 헬퍼 함수만 추가 (사용처는 PR-3부터)
--
-- 안전 검증:
--   1) 이 SQL 실행 후에도 기존 KEG 서비스가 100% 동일하게 동작해야 함
--   2) /api/admin/db-check 통과
--   3) 학생 1명이 평소처럼 Studio·Cast·Tutor 사용 가능 확인
-- ─────────────────────────────────────────────────────────

-- ═══ 1. tenants 테이블 ═══════════════════════════════════
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),  -- URL safe
  tenant_type text not null default 'internal'
    check (tenant_type in ('internal', 'b2b_customer', 'demo')),
  plan text not null default 'enterprise'
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  max_students int,
  max_courses int,
  custom_domain text,
  branding jsonb default '{}'::jsonb,
  config jsonb default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'trial', 'archived')),
  contract_start date,
  contract_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenants_slug on public.tenants(slug);
create index if not exists idx_tenants_status on public.tenants(status) where status = 'active';

alter table public.tenants enable row level security;

-- 임시 정책: 모든 인증 사용자가 읽기 가능 (PR-3에서 세분화)
drop policy if exists "auth reads tenants" on public.tenants;
create policy "auth reads tenants" on public.tenants
  for select to authenticated using (true);

drop policy if exists "admin manages tenants" on public.tenants;
create policy "admin manages tenants" on public.tenants
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ═══ 2. KEG 첫 번째 테넌트 등록 (고정 UUID) ════════════════
-- 고정 UUID 사용 → PR-2 backfill 시 명확한 참조
insert into public.tenants (id, name, slug, tenant_type, plan, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'KEG 교육 그룹',
  'keg',
  'internal',
  'enterprise',
  'active'
)
on conflict (id) do nothing;

-- ═══ 3. tenant_id 컬럼 추가 (NULL 허용) ════════════════════
-- 핵심 테이블에 컬럼만 추가. 누락 테이블은 안전하게 스킵 (DO + IF EXISTS).
-- backfill + NOT NULL은 PR-2.

do $$
declare
  tbl text;
  tbls text[] := array[
    'profiles', 'studio_jobs', 'cast_jobs', 'tutor_conversations',
    'user_avatars', 'sme_evaluations', 'kpi_metrics', 'student_enrollments',
    'api_keys', 'instructor_assets', 'studio_pro_jobs'
  ];
begin
  foreach tbl in array tbls loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      execute format(
        'alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)',
        tbl
      );
      raise notice '[0034] tenant_id added to %', tbl;
    else
      raise notice '[0034] SKIP % (table does not exist)', tbl;
    end if;
  end loop;
end $$;

-- 인덱스 (조회 성능 — RLS가 매번 tenant_id로 필터함)
-- 컬럼이 추가된 테이블에만 인덱스 생성
do $$
declare
  rec record;
begin
  for rec in
    select table_name from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_id'
      and table_name in (
        'profiles', 'studio_jobs', 'cast_jobs', 'tutor_conversations',
        'user_avatars', 'sme_evaluations', 'kpi_metrics', 'student_enrollments',
        'api_keys', 'instructor_assets', 'studio_pro_jobs'
      )
  loop
    -- studio_jobs / cast_jobs는 created_at desc 복합 인덱스 (조회 패턴 일치)
    if rec.table_name in ('studio_jobs', 'cast_jobs') then
      execute format(
        'create index if not exists idx_%s_tenant on public.%I(tenant_id, created_at desc)',
        rec.table_name, rec.table_name
      );
    else
      execute format(
        'create index if not exists idx_%s_tenant on public.%I(tenant_id)',
        rec.table_name, rec.table_name
      );
    end if;
  end loop;
end $$;

-- ═══ 4. 역할 확장 — keg_super_admin + tenant_admin ════════
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'user',                  -- 학생 (기존)
    'admin',                 -- KEG 내부 관리자 (기존)
    'sme',
    'instructor',
    'operations',
    'creator',
    'customer',              -- B2B API 키 사용자 (v0.40)
    'keg_super_admin',       -- 신규: 모든 테넌트 통합 관리 (본부장·CEO)
    'tenant_admin'           -- 신규: 자기 테넌트만 관리 (외부 고객사)
  ));

-- ═══ 5. 헬퍼 함수 (PR-3에서 RLS 정책이 사용) ═══════════════

-- 현재 사용자의 tenant_id 반환 (cookie context 기준)
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;
grant execute on function public.current_tenant_id() to authenticated;

-- 현재 사용자가 테넌트 관리자인가?
create or replace function public.is_tenant_admin(uid uuid, target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and tenant_id = target_tenant
      and role in ('admin', 'tenant_admin', 'keg_super_admin')
  );
$$;
grant execute on function public.is_tenant_admin(uuid, uuid) to authenticated;

-- 현재 사용자가 KEG super admin인가? (모든 테넌트 접근)
create or replace function public.is_keg_super_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'keg_super_admin'
  );
$$;
grant execute on function public.is_keg_super_admin(uuid) to authenticated;

-- ═══ 6. 호환성 — 기존 is_admin / is_admin_or_ops 유지 ═════
-- 이 함수들은 0027에서 정의됨. PR-3 RLS 재작성 시까지 변경 없음.
-- PR-3에서 tenant 격리 추가됨.

-- ═══ 검증 쿼리 (수동 실행) ════════════════════════════════
-- 적용 후 본부장이 실행해서 결과 확인:
--   1. SELECT * FROM tenants;
--      → KEG row 1개 보여야 함
--   2. SELECT column_name FROM information_schema.columns
--      WHERE table_schema = 'public' AND column_name = 'tenant_id';
--      → 위 11개 테이블 모두 출력되어야 함
--   3. SELECT proname FROM pg_proc WHERE proname IN
--      ('current_tenant_id', 'is_tenant_admin', 'is_keg_super_admin');
--      → 3개 함수 모두 출력
