-- ─────────────────────────────────────────────────────────
-- 0028_multi_course.sql
-- v0.38.0 W11 — 학생이 여러 과정 동시 수강 가능
--
-- 모델 결정: 각 studio_job을 하나의 '과정 단위'로 간주.
-- 더 큰 'course series' 개념은 v0.39.0+ (course 테이블 도입 시점).
-- ─────────────────────────────────────────────────────────

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'dropped')),
  progress_data jsonb,
  -- 학생당 같은 과정 중복 등록 불가
  unique(student_id, studio_job_id)
);

create index if not exists enrollments_student_idx
  on public.student_enrollments(student_id, enrolled_at desc);
create index if not exists enrollments_course_idx
  on public.student_enrollments(studio_job_id);
create index if not exists enrollments_active_idx
  on public.student_enrollments(student_id) where status = 'active';

alter table public.student_enrollments enable row level security;

-- 학생 본인 등록만 조회·생성·해지
drop policy if exists "Students manage own enrollments" on public.student_enrollments;
create policy "Students manage own enrollments"
  on public.student_enrollments for all
  using (auth.uid() = student_id or public.is_admin(auth.uid()))
  with check (auth.uid() = student_id);

-- admin/instructor는 모든 학생 조회 (지도 목적)
drop policy if exists "Staff view all enrollments" on public.student_enrollments;
create policy "Staff view all enrollments"
  on public.student_enrollments for select
  using (
    auth.uid() = student_id
    or public.is_admin(auth.uid())
    or public.is_instructor_or_admin(auth.uid())
  );

-- NPS 응답을 특정 과정과 연결 (선택적 — overall NPS는 NULL 유지)
alter table public.nps_responses
  add column if not exists studio_job_id uuid references public.studio_jobs(id) on delete set null;
create index if not exists nps_studio_job_idx
  on public.nps_responses(studio_job_id, created_at desc);
