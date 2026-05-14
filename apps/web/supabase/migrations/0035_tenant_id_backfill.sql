-- ─────────────────────────────────────────────────────────
-- 0035_tenant_id_backfill.sql
-- Phase 4 PR-2 — 기존 데이터를 KEG 테넌트로 backfill + NOT NULL 전환
--
-- 사전 조건:
--   - 0034 (tenants 테이블 + tenant_id 컬럼) 적용됨
--   - 0034a (누락 테이블 3개 복구) 적용됨
--   - KEG 테넌트 id = '00000000-0000-0000-0000-000000000001'
--
-- 위험도: 중간
--   - 대량 UPDATE — 트랜잭션 단위로 안전 (실패 시 전체 롤백)
--   - NOT NULL 전환 — backfill 완료 보장 후에만
--   - PR-3에서 RLS 격리하기 전 단계 (이 시점까지는 기존 RLS 유지)
--
-- 적용 순서:
--   1. SELECT count로 사전 점검 (NULL row 카운트)
--   2. UPDATE backfill
--   3. SELECT count로 검증 (모두 KEG로 채워졌는가)
--   4. NOT NULL 제약 추가
--
-- 롤백 (필요 시):
--   ALTER TABLE ... ALTER COLUMN tenant_id DROP NOT NULL;
--   UPDATE ... SET tenant_id = NULL;
-- ─────────────────────────────────────────────────────────

-- ═══ Phase 1: Backfill — 기존 모든 row에 KEG tenant_id ═════
do $$
declare
  rec record;
  keg_id uuid := '00000000-0000-0000-0000-000000000001';
  updated_count bigint;
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
    execute format(
      'update public.%I set tenant_id = $1 where tenant_id is null',
      rec.table_name
    ) using keg_id;
    get diagnostics updated_count = row_count;
    raise notice '[0035 backfill] % rows updated: %', rec.table_name, updated_count;
  end loop;
end $$;

-- ═══ Phase 2: 검증 — backfill 후 NULL 카운트 = 0 확인 ════════
-- 이 블록은 NULL row가 남아 있으면 에러로 abort (안전장치)
do $$
declare
  rec record;
  null_count bigint;
  total_null bigint := 0;
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
    execute format(
      'select count(*) from public.%I where tenant_id is null',
      rec.table_name
    ) into null_count;
    if null_count > 0 then
      raise notice '[0035 verify] WARN: % still has % NULL tenant_id rows', rec.table_name, null_count;
      total_null := total_null + null_count;
    end if;
  end loop;

  if total_null > 0 then
    raise exception '[0035] backfill incomplete — % total NULL rows remaining. Aborting before NOT NULL.', total_null;
  end if;

  raise notice '[0035 verify] ✓ All tenant_id columns fully backfilled. Proceeding to NOT NULL.';
end $$;

-- ═══ Phase 3: NOT NULL 제약 추가 ═══════════════════════════
do $$
declare
  rec record;
begin
  for rec in
    select table_name from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_id'
      and is_nullable = 'YES'
      and table_name in (
        'profiles', 'studio_jobs', 'cast_jobs', 'tutor_conversations',
        'user_avatars', 'sme_evaluations', 'kpi_metrics', 'student_enrollments',
        'api_keys', 'instructor_assets', 'studio_pro_jobs'
      )
  loop
    execute format(
      'alter table public.%I alter column tenant_id set not null',
      rec.table_name
    );
    raise notice '[0035 NOT NULL] %', rec.table_name;
  end loop;
end $$;

-- ═══ Phase 4: 신규 row에 자동으로 KEG tenant_id 할당 ════════
-- profiles의 default는 trigger로 처리 (auth.users 생성 시 자동 생성됨)
-- 다른 테이블은 application-layer에서 명시적으로 설정 (PR-3 RLS 정책이 강제)
--
-- profiles는 default 추가 — 신규 사용자도 자동으로 KEG에 소속
alter table public.profiles
  alter column tenant_id set default '00000000-0000-0000-0000-000000000001'::uuid;

-- 다른 테이블도 KEG default 임시 설정 (PR-3에서 RLS가 강제하지만 안전망)
do $$
declare
  rec record;
begin
  for rec in
    select table_name from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_id'
      and table_name in (
        'studio_jobs', 'cast_jobs', 'tutor_conversations',
        'user_avatars', 'sme_evaluations', 'kpi_metrics', 'student_enrollments',
        'api_keys', 'instructor_assets', 'studio_pro_jobs'
      )
  loop
    execute format(
      'alter table public.%I alter column tenant_id set default ''00000000-0000-0000-0000-000000000001''::uuid',
      rec.table_name
    );
  end loop;
end $$;

-- ═══ 검증 쿼리 (수동 실행 권장) ════════════════════════════
-- 1. 모든 테이블 tenant_id가 NOT NULL인가
--    SELECT table_name, is_nullable FROM information_schema.columns
--    WHERE table_schema = 'public' AND column_name = 'tenant_id';
--    → 11 rows, is_nullable = 'NO' 모두
--
-- 2. KEG row 카운트가 기존 row 수와 일치하는가
--    SELECT 'studio_jobs' AS t, count(*) AS keg_rows FROM studio_jobs
--    WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
