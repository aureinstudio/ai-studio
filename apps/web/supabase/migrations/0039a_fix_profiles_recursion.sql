-- ─────────────────────────────────────────────────────────
-- 0039a_fix_profiles_recursion.sql
-- Phase 4 PR-3 Tier 4 긴급 patch — profiles RLS 재귀 fix
--
-- 문제:
--   "tenant select profiles" 정책이 EXISTS(SELECT FROM profiles ...) 사용 →
--   profiles에서 다시 profiles RLS 평가 → 재귀 또는 본인 row까지 차단.
--
-- 해결:
--   SECURITY DEFINER 함수로 staff 여부 판정 → RLS 우회.
-- ─────────────────────────────────────────────────────────

-- 헬퍼 함수: 사용자가 staff 역할인가? (SECURITY DEFINER로 RLS 우회)
create or replace function public.is_staff_member(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and role in ('admin', 'tenant_admin', 'instructor', 'sme', 'operations', 'keg_super_admin')
  );
$$;
grant execute on function public.is_staff_member(uuid) to authenticated;

-- 기존 재귀 정책 제거
drop policy if exists "tenant select profiles" on public.profiles;

-- 새 정책: 헬퍼 함수 사용 (재귀 없음)
create policy "tenant select profiles" on public.profiles
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and public.is_staff_member(auth.uid())
    )
  );

-- ═══ 검증 ════════════════════════════════════════════════
-- SELECT id, email, role FROM profiles WHERE id = auth.uid();
-- → 본인 row 즉시 보여야 함
