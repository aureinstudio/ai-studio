-- ─────────────────────────────────────────────────────────
-- 0036a_drop_legacy_policies_tier1.sql
-- Phase 4 PR-3 Tier 1 보정 — legacy 정책 제거
--
-- 발견: 0036에서 새 tenant 정책을 추가했지만 legacy 정책 이름이 달라서
--       drop이 작동 안 함. PERMISSIVE 정책은 OR 결합 → legacy가 tenant 격리 우회.
--
-- 이 마이그레이션은:
--   - tier 1 테이블의 알려진 legacy 정책 모두 제거
--   - 신규 tenant 정책만 남김
--
-- 적용 후 검증:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('studio_jobs', 'cast_jobs', 'tutor_conversations')
--   ORDER BY tablename, policyname;
--   → 각 테이블당 정확히 4개 (tenant select/insert/update/delete)
--   → studio_jobs는 'Public can read sample jobs' 1개 추가 가능 (samples 기능)
-- ─────────────────────────────────────────────────────────

-- ═══ cast_jobs legacy 제거 ═════════════════════════════════
drop policy if exists "Users can read own cast jobs" on public.cast_jobs;
drop policy if exists "Users can insert own cast jobs" on public.cast_jobs;
drop policy if exists "Users can update own cast jobs" on public.cast_jobs;
drop policy if exists "Users can delete own cast jobs" on public.cast_jobs;
drop policy if exists "Admin can read all cast jobs" on public.cast_jobs;
drop policy if exists "Admins read all cast jobs" on public.cast_jobs;

-- ═══ tutor_conversations legacy 제거 ═══════════════════════
drop policy if exists "Admin read all conversations" on public.tutor_conversations;
drop policy if exists "Students insert own conversations" on public.tutor_conversations;
drop policy if exists "Students read own conversations" on public.tutor_conversations;
drop policy if exists "Students update own conversations" on public.tutor_conversations;
drop policy if exists "Students delete own conversations" on public.tutor_conversations;

-- ═══ studio_jobs legacy 제거 ═══════════════════════════════
-- ⚠ "Public can read sample jobs"는 /samples 페이지가 공개 샘플을 보여주기 위함.
-- 보존하되 tenant_id 필터 추가 (PR-3 Tier 4에서 처리). 여기선 그대로 둠.

-- ═══ 검증 ════════════════════════════════════════════════
-- SELECT tablename, count(*) FROM pg_policies
-- WHERE tablename IN ('studio_jobs', 'cast_jobs', 'tutor_conversations')
-- GROUP BY tablename;
--
-- 예상:
--   cast_jobs               4 (tenant select/insert/update/delete)
--   studio_jobs             5 (tenant 4개 + "Public can read sample jobs")
--   tutor_conversations     4
