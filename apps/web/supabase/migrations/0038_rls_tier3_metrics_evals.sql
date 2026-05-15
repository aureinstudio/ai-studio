-- ─────────────────────────────────────────────────────────
-- 0038_rls_tier3_metrics_evals.sql  (v2 — IF EXISTS 가드)
-- Phase 4 PR-3 Tier 3 — RLS 테넌트 격리 (KPI·평가·수강)
--
-- 대상: kpi_metrics, sme_evaluations, student_enrollments
-- 누락 테이블은 안전 스킵 (운영자가 별도 처리).
-- ─────────────────────────────────────────────────────────

-- ═══ kpi_metrics ═══════════════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kpi_metrics'
  ) then
    drop policy if exists "admin reads kpi" on public.kpi_metrics;
    drop policy if exists "admin writes kpi" on public.kpi_metrics;
    drop policy if exists "tenant select kpi_metrics" on public.kpi_metrics;
    drop policy if exists "tenant insert kpi_metrics" on public.kpi_metrics;
    drop policy if exists "tenant update kpi_metrics" on public.kpi_metrics;
    drop policy if exists "tenant delete kpi_metrics" on public.kpi_metrics;

    execute $POL$
      create policy "tenant select kpi_metrics" on public.kpi_metrics
        for select to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
        )
    $POL$;
    execute $POL$
      create policy "tenant insert kpi_metrics" on public.kpi_metrics
        for insert to authenticated
        with check (
          tenant_id = public.current_tenant_id()
          and (public.is_admin(auth.uid()) or public.is_keg_super_admin(auth.uid()))
        )
    $POL$;
    execute $POL$
      create policy "tenant update kpi_metrics" on public.kpi_metrics
        for update to authenticated
        using (public.is_keg_super_admin(auth.uid()) or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid())))
        with check (public.is_keg_super_admin(auth.uid()) or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid())))
    $POL$;
    execute $POL$
      create policy "tenant delete kpi_metrics" on public.kpi_metrics
        for delete to authenticated
        using (public.is_keg_super_admin(auth.uid()) or (tenant_id = public.current_tenant_id() and public.is_admin(auth.uid())))
    $POL$;
    raise notice '[0038] kpi_metrics policies applied';
  else
    raise notice '[0038] SKIP kpi_metrics (table does not exist)';
  end if;
end $$;

-- ═══ sme_evaluations ═══════════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sme_evaluations'
  ) then
    drop policy if exists "Anyone can submit SME evaluation" on public.sme_evaluations;
    drop policy if exists "Anyone can read sample evaluations" on public.sme_evaluations;
    drop policy if exists "Admin can read all evaluations" on public.sme_evaluations;
    drop policy if exists "tenant select sme_evaluations" on public.sme_evaluations;
    drop policy if exists "tenant insert sme_evaluations" on public.sme_evaluations;
    drop policy if exists "tenant update sme_evaluations" on public.sme_evaluations;
    drop policy if exists "tenant delete sme_evaluations" on public.sme_evaluations;

    execute $POL$
      create policy "tenant select sme_evaluations" on public.sme_evaluations
        for select to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (
            tenant_id = public.current_tenant_id()
            and (
              evaluator_id = auth.uid()
              or public.is_tenant_admin(auth.uid(), tenant_id)
              or exists (select 1 from public.profiles where id = auth.uid() and role in ('sme','admin','operations'))
            )
          )
        )
    $POL$;
    execute $POL$
      create policy "tenant insert sme_evaluations" on public.sme_evaluations
        for insert to authenticated
        with check (
          tenant_id = public.current_tenant_id()
          and (evaluator_id = auth.uid() or public.is_keg_super_admin(auth.uid()))
        )
    $POL$;
    execute $POL$
      create policy "tenant update sme_evaluations" on public.sme_evaluations
        for update to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (evaluator_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
        with check (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (evaluator_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
    $POL$;
    execute $POL$
      create policy "tenant delete sme_evaluations" on public.sme_evaluations
        for delete to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
        )
    $POL$;
    raise notice '[0038] sme_evaluations policies applied';
  else
    raise notice '[0038] SKIP sme_evaluations';
  end if;
end $$;

-- ═══ student_enrollments ═══════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'student_enrollments'
  ) then
    drop policy if exists "Students manage own enrollments" on public.student_enrollments;
    drop policy if exists "Staff view all enrollments" on public.student_enrollments;
    drop policy if exists "tenant select student_enrollments" on public.student_enrollments;
    drop policy if exists "tenant insert student_enrollments" on public.student_enrollments;
    drop policy if exists "tenant update student_enrollments" on public.student_enrollments;
    drop policy if exists "tenant delete student_enrollments" on public.student_enrollments;

    execute $POL$
      create policy "tenant select student_enrollments" on public.student_enrollments
        for select to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
    $POL$;
    execute $POL$
      create policy "tenant insert student_enrollments" on public.student_enrollments
        for insert to authenticated
        with check (student_id = auth.uid() and tenant_id = public.current_tenant_id())
    $POL$;
    execute $POL$
      create policy "tenant update student_enrollments" on public.student_enrollments
        for update to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
        with check (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
    $POL$;
    execute $POL$
      create policy "tenant delete student_enrollments" on public.student_enrollments
        for delete to authenticated
        using (
          public.is_keg_super_admin(auth.uid())
          or (tenant_id = public.current_tenant_id() and (student_id = auth.uid() or public.is_tenant_admin(auth.uid(), tenant_id)))
        )
    $POL$;
    raise notice '[0038] student_enrollments policies applied';
  else
    raise notice '[0038] SKIP student_enrollments';
  end if;
end $$;
