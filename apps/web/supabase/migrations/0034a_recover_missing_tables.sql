-- ─────────────────────────────────────────────────────────
-- 0034a_recover_missing_tables.sql
-- Phase 4 PR-1 보정 — 누락 테이블 복구
--
-- 발견: 다음 3개 테이블이 PostgREST 캐시에는 보였으나 실제 DB에 없음
--   - kpi_metrics       (원래 0021 — KPI 추적)
--   - instructor_assets (원래 0033 — 강사 사진·음성 자산)
--   - studio_pro_jobs   (원래 0033 — Studio Pro 작업)
--
-- 원인: 과거 0021·0033 마이그레이션이 일부 실패했거나 부분 적용된 것으로 추정.
--
-- 이 마이그레이션은:
--   1. 누락 3개 테이블을 안전하게 생성 (IF NOT EXISTS)
--   2. tenant_id 컬럼 + 인덱스 추가 (0034 동일 처리)
--   3. RLS + 기본 정책 적용
--
-- 적용 후: SELECT FROM pg_class로 3개 테이블 모두 보여야 함.
-- ─────────────────────────────────────────────────────────

-- ═══ kpi_metrics (W11 KPI 추적) ═════════════════════════
create table if not exists public.kpi_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_type text not null,
  value numeric not null,
  metadata jsonb,
  recorded_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  tenant_id uuid references public.tenants(id)
);
create index if not exists idx_kpi_metrics_type_time on public.kpi_metrics(metric_type, recorded_at desc);
create index if not exists idx_kpi_metrics_tenant on public.kpi_metrics(tenant_id);

alter table public.kpi_metrics enable row level security;
drop policy if exists "admin reads kpi" on public.kpi_metrics;
create policy "admin reads kpi" on public.kpi_metrics
  for select to authenticated
  using (public.is_admin_or_ops(auth.uid()));
drop policy if exists "admin writes kpi" on public.kpi_metrics;
create policy "admin writes kpi" on public.kpi_metrics
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ═══ instructor_assets (v0.45 강사 사진·음성) ════════════
create table if not exists public.instructor_assets (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade unique,
  photo_url text,
  voice_sample_url text,
  heygen_talking_photo_id text,
  heygen_voice_id text,
  status text not null default 'pending'
    check (status in ('pending','registered','failed')),
  tenant_id uuid references public.tenants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_instructor_assets_tenant on public.instructor_assets(tenant_id);

alter table public.instructor_assets enable row level security;
drop policy if exists "instructor manages own assets" on public.instructor_assets;
create policy "instructor manages own assets" on public.instructor_assets
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));

-- ═══ studio_pro_jobs (v0.43 Studio Pro) ═════════════════
create table if not exists public.studio_pro_jobs (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_file_url text,
  source_file_type text,
  extracted_text text,
  enhanced_content jsonb,
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  cast_job_id uuid references public.cast_jobs(id) on delete set null,
  status text not null default 'uploaded'
    check (status in ('uploaded','extracting','enhancing','synthesizing_video','completed','failed')),
  error text,
  tenant_id uuid references public.tenants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_studio_pro_instructor on public.studio_pro_jobs(instructor_id, created_at desc);
create index if not exists idx_studio_pro_status on public.studio_pro_jobs(status) where status not in ('completed','failed');
create index if not exists idx_studio_pro_jobs_tenant on public.studio_pro_jobs(tenant_id);

alter table public.studio_pro_jobs enable row level security;
drop policy if exists "instructor manages own pro jobs" on public.studio_pro_jobs;
create policy "instructor manages own pro jobs" on public.studio_pro_jobs
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));

-- ═══ PostgREST 스키마 캐시 강제 갱신 ═══════════════════════
-- 새 테이블이 PostgREST API에 즉시 노출되도록.
notify pgrst, 'reload schema';

-- ═══ 검증 ════════════════════════════════════════════════
-- SELECT relname FROM pg_class
-- WHERE relname IN ('kpi_metrics', 'instructor_assets', 'studio_pro_jobs');
-- → 3 rows 출력되어야 함
