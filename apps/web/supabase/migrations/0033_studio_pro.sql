-- ─────────────────────────────────────────────────────────
-- 0033_studio_pro.sql
-- v0.43.0 Studio Pro — 강사 자료 업로드 + AI 보강 + 본인 영상 합성
-- 기존 Studio (AI 100% 생성) 와 다른 별도 워크플로우.
-- ─────────────────────────────────────────────────────────

-- 강사 자료 기반 작업 (Studio Pro)
create table if not exists public.studio_pro_jobs (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_file_url text,                  -- 업로드된 원본 (md/txt/pdf/pptx)
  source_file_type text,
  extracted_text text,                   -- 추출된 본문
  enhanced_content jsonb,                -- AI 보강 결과 (Studio agents 결과 재활용)
  studio_job_id uuid references public.studio_jobs(id) on delete set null,   -- 보강 후 studio_jobs로 승급
  cast_job_id uuid references public.cast_jobs(id) on delete set null,        -- 영상 합성 결과
  status text not null default 'uploaded'
    check (status in ('uploaded','extracting','enhancing','synthesizing_video','completed','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_studio_pro_instructor on public.studio_pro_jobs(instructor_id, created_at desc);
create index if not exists idx_studio_pro_status on public.studio_pro_jobs(status) where status not in ('completed','failed');

alter table public.studio_pro_jobs enable row level security;
drop policy if exists "instructor manages own pro jobs" on public.studio_pro_jobs;
create policy "instructor manages own pro jobs" on public.studio_pro_jobs
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));

-- 강사 자산: HeyGen talking_photo_id + voice_id (1회 등록, 재사용)
create table if not exists public.instructor_assets (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade unique,
  photo_url text,                        -- 업로드 원본 사진
  voice_sample_url text,                 -- 업로드 음성 샘플
  heygen_talking_photo_id text,          -- HeyGen 등록 후 ID
  heygen_voice_id text,                  -- Voice Clone 등록 후 ID
  status text not null default 'pending'
    check (status in ('pending','registered','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instructor_assets enable row level security;
drop policy if exists "instructor manages own assets" on public.instructor_assets;
create policy "instructor manages own assets" on public.instructor_assets
  for all to authenticated
  using (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()))
  with check (instructor_id = auth.uid() or public.is_admin_or_ops(auth.uid()));

-- Storage 버킷 (Supabase Studio에서 수동 생성 필요)
-- 1) studio-pro-uploads (private) — 강사 자료
-- 2) instructor-photos (private) — 강사 사진
-- 3) instructor-voices (private) — 강사 음성 샘플
