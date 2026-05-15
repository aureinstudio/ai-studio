-- ─────────────────────────────────────────────────────────
-- 0037_rls_tier2_instructor_assets.sql
-- Phase 4 PR-3 Tier 2 — RLS 테넌트 격리 (강사 자산·Studio Pro·아바타)
--
-- 대상: instructor_assets, studio_pro_jobs, user_avatars
--
-- 격리 규칙: Tier 1과 동일 (같은 테넌트 본인 + tenant_admin + super_admin)
-- ─────────────────────────────────────────────────────────

-- ═══ instructor_assets ═════════════════════════════════════
-- 컬럼: instructor_id (소유자)
drop policy if exists "instructor manages own assets" on public.instructor_assets;
drop policy if exists "tenant select instructor_assets" on public.instructor_assets;
drop policy if exists "tenant insert instructor_assets" on public.instructor_assets;
drop policy if exists "tenant update instructor_assets" on public.instructor_assets;
drop policy if exists "tenant delete instructor_assets" on public.instructor_assets;

create policy "tenant select instructor_assets" on public.instructor_assets
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant insert instructor_assets" on public.instructor_assets
  for insert to authenticated
  with check (
    instructor_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update instructor_assets" on public.instructor_assets
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant delete instructor_assets" on public.instructor_assets
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ studio_pro_jobs ═══════════════════════════════════════
-- 컬럼: instructor_id (소유자)
drop policy if exists "instructor manages own pro jobs" on public.studio_pro_jobs;
drop policy if exists "tenant select studio_pro_jobs" on public.studio_pro_jobs;
drop policy if exists "tenant insert studio_pro_jobs" on public.studio_pro_jobs;
drop policy if exists "tenant update studio_pro_jobs" on public.studio_pro_jobs;
drop policy if exists "tenant delete studio_pro_jobs" on public.studio_pro_jobs;

create policy "tenant select studio_pro_jobs" on public.studio_pro_jobs
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant insert studio_pro_jobs" on public.studio_pro_jobs
  for insert to authenticated
  with check (
    instructor_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update studio_pro_jobs" on public.studio_pro_jobs
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant delete studio_pro_jobs" on public.studio_pro_jobs
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (instructor_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ user_avatars ══════════════════════════════════════════
-- 컬럼: user_id (소유자)
drop policy if exists "Users can read own avatars" on public.user_avatars;
drop policy if exists "Users can insert own avatars" on public.user_avatars;
drop policy if exists "Users can update own avatars" on public.user_avatars;
drop policy if exists "Users can delete own avatars" on public.user_avatars;
drop policy if exists "Admins read all avatars" on public.user_avatars;
drop policy if exists "tenant select user_avatars" on public.user_avatars;
drop policy if exists "tenant insert user_avatars" on public.user_avatars;
drop policy if exists "tenant update user_avatars" on public.user_avatars;
drop policy if exists "tenant delete user_avatars" on public.user_avatars;

create policy "tenant select user_avatars" on public.user_avatars
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant insert user_avatars" on public.user_avatars
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update user_avatars" on public.user_avatars
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant delete user_avatars" on public.user_avatars
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ 검증 ════════════════════════════════════════════════
-- SELECT tablename, count(*) FROM pg_policies
-- WHERE tablename IN ('instructor_assets', 'studio_pro_jobs', 'user_avatars')
-- GROUP BY tablename;
-- → 각 4 rows (총 12)
