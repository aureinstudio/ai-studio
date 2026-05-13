-- ─────────────────────────────────────────────────────────
-- 0026_course_adaptation.sql
-- v0.36.0 Phase 3 — 일반 과정 어댑테이션 레이어
-- studio_jobs를 자격증 외 4개 카테고리로 확장.
-- ─────────────────────────────────────────────────────────

alter table public.studio_jobs
  add column if not exists course_category text not null default 'certification'
    check (course_category in (
      'certification',  -- 자격증 (기존 기본)
      'professional',   -- 직무 교육 (디자인·마케팅·개발)
      'language',       -- 언어 (영어·일본어)
      'hobby',          -- 취미 (요리·사진)
      'academic'        -- 학술 (수능·고등)
    ));

alter table public.studio_jobs
  add column if not exists adaptation_profile jsonb;
  -- 형태: { content_style, assessment_type, learning_pace, completion_criteria,
  --        language_priority: [...], tone }

create index if not exists studio_jobs_category_idx
  on public.studio_jobs(course_category, created_at desc);

-- 기존 자격증 영역 row는 자동으로 default 'certification'으로 분류됨
-- (is_certification=true 옛 컬럼은 호환성 유지 — 사용처가 점진 마이그레이션).
