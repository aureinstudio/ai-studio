-- ─────────────────────────────────────────────────────────
-- 0038_rls_tier3_metrics_evals.sql
-- Phase 4 PR-3 Tier 3 — RLS 테넌트 격리 (KPI·평가·수강)
--
-- 대상: kpi_metrics, sme_evaluations, student_enrollments
--
-- 격리 규칙:
--   - kpi_metrics       : 같은 테넌트 admin/ops + super_admin (학생 노출 X)
--   - sme_evaluations   : 같은 테넌트 sme/admin + super_admin
--   - student_enrollments: 같은 테넌트 본인 학생 + admin + super_admin
-- ─────────────────────────────────────────────────────────

-- ═══ kpi_metrics ═══════════════════════════════════════════
drop policy if exists "admin reads kpi" on public.kpi_metrics;
drop policy if exists "admin writes kpi" on public.kpi_metrics;
drop policy if exists "tenant select kpi_metrics" on public.kpi_metrics;
drop policy if exists "tenant insert kpi_metrics" on public.kpi_metrics;
drop policy if exists "tenant update kpi_metrics" on public.kpi_metrics;
drop policy if exists "tenant delete kpi_metrics" on public.kpi_metrics;

create policy "tenant select kpi_metrics" on public.kpi_metrics
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and public.is_admin_or_ops(auth.uid())
    )
  );

create policy "tenant insert kpi_metrics" on public.kpi_metrics
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_admin(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  );

create policy "tenant update kpi_metrics" on public.kpi_metrics
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid()))
  );

create policy "tenant delete kpi_metrics" on public.kpi_metrics
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid()))
  );

-- ═══ sme_evaluations ═══════════════════════════════════════
-- 컬럼: evaluator_id (SME 본인), studio_job_id, 평가 데이터
drop policy if exists "Anyone can submit SME evaluation" on public.sme_evaluations;
drop policy if exists "Anyone can read sample evaluations" on public.sme_evaluations;
drop policy if exists "Admin can read all evaluations" on public.sme_evaluations;
drop policy if exists "tenant select sme_evaluations" on public.sme_evaluations;
drop policy if exists "tenant insert sme_evaluations" on public.sme_evaluations;
drop policy if exists "tenant update sme_evaluations" on public.sme_evaluations;
drop policy if exists "tenant delete sme_evaluations" on public.sme_evaluations;

create policy "tenant select sme_evaluations" on public.sme_evaluations
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (
        evaluator_id = auth.uid()
        or public.is_tenant_admin(auth.uid(), tenant_id)
        or exists (
          select 1 from public.profiles
          where id = auth.uid() and role in ('sme', 'admin', 'operations')
        )
      )
    )
  );

create policy "tenant insert sme_evaluations" on public.sme_evaluations
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (
      evaluator_id = auth.uid()
      or public.is_keg_super_admin(auth.uid())
    )
  );

create policy "tenant update sme_evaluations" on public.sme_evaluations
  for update to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (evaluator_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (evaluator_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant delete sme_evaluations" on public.sme_evaluations
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  );

-- ═══ student_enrollments ═══════════════════════════════════
-- 컬럼: student_id (학생), studio_job_id, status
drop policy if exists "Students manage own enrollments" on public.student_enrollments;
drop policy if exists "Staff view all enrollments" on public.student_enrollments;
drop policy if exists "tenant select student_enrollments" on public.student_enrollments;
drop policy if exists "tenant insert student_enrollments" on public.student_enrollments;
drop policy if exists "tenant update student_enrollments" on public.student_enrollments;
drop policy if exists "tenant delete student_enrollments" on public.student_enrollments;

create policy "tenant select student_enrollments" on public.student_enrollments
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

create policy "tenant insert student_enrollments" on public.student_enrollments
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and tenant_id = public.current_tenant_id()
  );

create policy "tenant update student_enrollments" on public.student_enrollments
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

create policy "tenant delete student_enrollments" on public.student_enrollments
  for delete to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (
      tenant_id = public.current_tenant_id()
      and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id))
    )
  );

-- ═══ 검증 ════════════════════════════════════════════════
-- SELECT tablename, count(*) FROM pg_policies
-- WHERE tablename IN ('kpi_metrics', 'sme_evaluations', 'student_enrollments')
-- GROUP BY tablename;
-- → 각 4 rows
