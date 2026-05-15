-- ─────────────────────────────────────────────────────────
-- 0039_rls_tier4_final.sql
-- Phase 4 PR-3 Tier 4 — RLS 마무리 (api_keys, profiles, tenants 정리)
--
-- 대상:
--   - api_keys              : B2B 키
--   - profiles              : 사용자 (⚠ 가장 신중 — 헬퍼 함수가 의존)
--   - tenants               : 테넌트 자체 조회 권한 세분화
--   - studio_jobs (sample)  : "Public can read sample jobs" 에 tenant 필터 추가
--
-- profiles 격리 원칙:
--   - 본인 row는 항상 SELECT/UPDATE 가능 (id = auth.uid())
--   - 같은 테넌트 멤버는 SELECT 가능 (강사·SME가 학생 조회 등)
--   - keg_super_admin은 모든 테넌트
--   - 헬퍼 함수(current_tenant_id 등)는 SECURITY DEFINER → RLS 우회. 영향 없음.
-- ─────────────────────────────────────────────────────────

-- ═══ api_keys ══════════════════════════════════════════════
drop policy if exists "admin manages api_keys" on public.api_keys;
drop policy if exists "owner reads own api_keys" on public.api_keys;
drop policy if exists "tenant select api_keys" on public.api_keys;
drop policy if exists "tenant insert api_keys" on public.api_keys;
drop policy if exists "tenant update api_keys" on public.api_keys;
drop policy if exists "tenant delete api_keys" on public.api_keys;

create policy "tenant select api_keys" on public.api_keys
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (owner_user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant insert api_keys" on public.api_keys
  for insert to authenticated
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and public.is_tenant_admin(auth.uid(), tenant_id)
    )
  );

create policy "tenant update api_keys" on public.api_keys
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  );

create policy "tenant delete api_keys" on public.api_keys
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  );

-- ═══ tenants 테이블 — 세분화 ════════════════════════════════
drop policy if exists "auth reads tenants" on public.tenants;
drop policy if exists "admin manages tenants" on public.tenants;
drop policy if exists "self reads own tenant" on public.tenants;
drop policy if exists "super admin manages tenants" on public.tenants;

-- 자기가 속한 테넌트 정보 SELECT (브랜딩·플랜 표시 등)
create policy "self reads own tenant" on public.tenants
  for select to authenticated
  using (
    id = public.current_tenant_id()
    or public.is_keg_super_admin(auth.uid())
  );

-- 신규 테넌트 생성·수정·삭제는 keg_super_admin만
create policy "super admin manages tenants" on public.tenants
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()));

-- ═══ studio_jobs sample 정책에 tenant 필터 추가 ════════════
-- 기존: "Public can read sample jobs" — 모든 테넌트 sample 노출 위험
-- 변경: 본인 테넌트 sample만 + super_admin
drop policy if exists "Public can read sample jobs" on public.studio_jobs;
drop policy if exists "tenant reads sample jobs" on public.studio_jobs;

create policy "tenant reads sample jobs" on public.studio_jobs
  for select to authenticated
  using (
    is_sample = true
    and deleted_at is null
    and (
      tenant_id = public.current_tenant_id()
      or public.is_keg_super_admin(auth.uid())
    )
  );

-- ═══ profiles (가장 신중) ══════════════════════════════════
-- 기존 정책 모두 제거. 새 정책 4개:
--   1. self select  : id = auth.uid() (본인은 항상)
--   2. tenant select: 같은 테넌트 멤버 (강사가 학생 조회 등)
--   3. self update  : id = auth.uid() (본인만 수정)
--   4. admin update : tenant admin이 같은 테넌트 멤버 role 변경 등

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read own profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins update all profiles" on public.profiles;
drop policy if exists "Authenticated can read profiles" on public.profiles;
drop policy if exists "self select profile" on public.profiles;
drop policy if exists "tenant select profiles" on public.profiles;
drop policy if exists "self update profile" on public.profiles;
drop policy if exists "admin update profiles" on public.profiles;

create policy "self select profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "tenant select profiles" on public.profiles
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and exists (
        select 1 from public.profiles p2
        where p2.id = auth.uid() and p2.role in ('admin','tenant_admin','instructor','sme','operations')
      )
    )
  );

create policy "self update profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admin update profiles" on public.profiles
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  );

-- INSERT 정책 (신규 가입 — Supabase Auth trigger가 처리)
drop policy if exists "self insert profile" on public.profiles;
create policy "self insert profile" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ═══ 검증 ════════════════════════════════════════════════
-- 1. 본인 프로필 조회 가능
--    SELECT id, email, role, tenant_id FROM profiles WHERE id = auth.uid();
-- 2. 정책 카운트
--    SELECT tablename, count(*) FROM pg_policies
--    WHERE tablename IN ('api_keys','tenants','profiles','studio_jobs')
--    GROUP BY tablename;
--    예상: api_keys 4, tenants 2, profiles 5 (self select/insert/update + tenant select + admin update),
--          studio_jobs 5 (tenant 4 + tenant reads sample jobs)
