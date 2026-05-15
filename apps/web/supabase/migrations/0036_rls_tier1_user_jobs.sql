-- ─────────────────────────────────────────────────────────
-- 0036_rls_tier1_user_jobs.sql
-- Phase 4 PR-3 Tier 1 — RLS 테넌트 격리 (사용자 작업 테이블)
--
-- 대상: studio_jobs, cast_jobs, tutor_conversations
--
-- 격리 모델: 완전 격리 (cross-tenant 공유 없음)
-- super_admin 권한: 모든 테넌트 접근 가능 (운영 편의)
--
-- 격리 규칙 (SELECT/UPDATE/DELETE):
--   1. 같은 테넌트의 본인 row, OR
--   2. 같은 테넌트의 admin (instructor·sme·operations·admin·tenant_admin), OR
--   3. keg_super_admin (모든 테넌트)
--
-- INSERT 규칙:
--   - 본인 user_id + 본인 tenant_id 일치만 허용 (default가 자동 KEG 적용)
--
-- 위험: 정책 변경 후 본인 row 안 보이면 즉시 롤백 (하단 ROLLBACK 참고)
-- ─────────────────────────────────────────────────────────

-- ═══ studio_jobs ═══════════════════════════════════════════
drop policy if exists "Users view own studio_jobs" on public.studio_jobs;
drop policy if exists "Users insert own studio_jobs" on public.studio_jobs;
drop policy if exists "Admins view all studio_jobs" on public.studio_jobs;
drop policy if exists "Users update own studio_jobs" on public.studio_jobs;
drop policy if exists "Admins update all studio_jobs" on public.studio_jobs;
drop policy if exists "tenant select studio_jobs" on public.studio_jobs;
drop policy if exists "tenant insert studio_jobs" on public.studio_jobs;
drop policy if exists "tenant update studio_jobs" on public.studio_jobs;
drop policy if exists "tenant delete studio_jobs" on public.studio_jobs;

create policy "tenant select studio_jobs" on public.studio_jobs
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (
        user_id = auth.uid()
        or public.is_tenant_admin(auth.uid(), tenant_id)
      )
    )
  );

create policy "tenant insert studio_jobs" on public.studio_jobs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update studio_jobs" on public.studio_jobs
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

create policy "tenant delete studio_jobs" on public.studio_jobs
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ cast_jobs ═════════════════════════════════════════════
drop policy if exists "Users view own cast_jobs" on public.cast_jobs;
drop policy if exists "Users insert own cast_jobs" on public.cast_jobs;
drop policy if exists "Admins view all cast_jobs" on public.cast_jobs;
drop policy if exists "Users update own cast_jobs" on public.cast_jobs;
drop policy if exists "Admins update all cast_jobs" on public.cast_jobs;
drop policy if exists "tenant select cast_jobs" on public.cast_jobs;
drop policy if exists "tenant insert cast_jobs" on public.cast_jobs;
drop policy if exists "tenant update cast_jobs" on public.cast_jobs;
drop policy if exists "tenant delete cast_jobs" on public.cast_jobs;

create policy "tenant select cast_jobs" on public.cast_jobs
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (
        user_id = auth.uid()
        or public.is_tenant_admin(auth.uid(), tenant_id)
      )
    )
  );

create policy "tenant insert cast_jobs" on public.cast_jobs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update cast_jobs" on public.cast_jobs
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

create policy "tenant delete cast_jobs" on public.cast_jobs
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (user_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ tutor_conversations ═══════════════════════════════════
-- tutor_conversations는 student_id 컬럼 사용 (user_id 아님)
drop policy if exists "Users view own tutor_conversations" on public.tutor_conversations;
drop policy if exists "Users insert own tutor_conversations" on public.tutor_conversations;
drop policy if exists "Users update own tutor_conversations" on public.tutor_conversations;
drop policy if exists "Admins view all tutor_conversations" on public.tutor_conversations;
drop policy if exists "tenant select tutor_conversations" on public.tutor_conversations;
drop policy if exists "tenant insert tutor_conversations" on public.tutor_conversations;
drop policy if exists "tenant update tutor_conversations" on public.tutor_conversations;
drop policy if exists "tenant delete tutor_conversations" on public.tutor_conversations;

create policy "tenant select tutor_conversations" on public.tutor_conversations
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (
        student_id = auth.uid()
        or public.is_tenant_admin(auth.uid(), tenant_id)
      )
    )
  );

create policy "tenant insert tutor_conversations" on public.tutor_conversations
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update tutor_conversations" on public.tutor_conversations
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant delete tutor_conversations" on public.tutor_conversations
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ 검증 (수동) ════════════════════════════════════════════
-- 1. KEG 사용자로 본인 studio_jobs 조회 — 평소처럼 보여야 함
-- 2. 본부장(admin) 계정으로 모든 studio_jobs 조회 가능 확인
-- 3. (다른 테넌트 만들고 별도 사용자 가입 후) cross-tenant 차단 확인

-- ═══ 롤백 SQL (필요 시) ═══════════════════════════════════
-- 본인 데이터가 안 보이면 즉시 아래 실행:
--
-- DROP POLICY "tenant select studio_jobs" ON public.studio_jobs;
-- CREATE POLICY "Users view own studio_jobs" ON public.studio_jobs
--   FOR SELECT TO authenticated USING (user_id = auth.uid());
-- CREATE POLICY "Admins view all studio_jobs" ON public.studio_jobs
--   FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
-- (cast_jobs, tutor_conversations 동일 패턴)
