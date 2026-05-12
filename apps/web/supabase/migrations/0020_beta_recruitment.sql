-- ─────────────────────────────────────────────────────────
-- 0020_beta_recruitment.sql
-- v0.29.0 — 베타 모집 + 온보딩 + 학습 알림 설정
-- ─────────────────────────────────────────────────────────

-- 1. beta_applications — 모집 신청
create table if not exists public.beta_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  course_interest text,
  motivation text,
  availability text,
  source text,                           -- UTM·캠페인 출처 (선택)
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'onboarded')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  invited_user_id uuid references auth.users(id) on delete set null,
  invite_sent_at timestamptz,
  first_login_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists beta_applications_email_uidx
  on public.beta_applications(lower(email));
create index if not exists beta_applications_status_idx
  on public.beta_applications(status, created_at desc);

alter table public.beta_applications enable row level security;

-- 신청은 누구나(인증 없이) — API 라우트가 service-role 사용. 일반 직접 select는 admin만.
drop policy if exists "Admins view beta_applications" on public.beta_applications;
create policy "Admins view beta_applications"
  on public.beta_applications for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins manage beta_applications" on public.beta_applications;
create policy "Admins manage beta_applications"
  on public.beta_applications for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2. profiles에 온보딩·학습 설정 컬럼 추가
alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;
  -- 형태: { step: 0~5, target_cert: "조리기능사", exam_date: "2026-07-01",
  --        preferred_hours: ["20:00-22:00"], language: "ko", completed_at: "..." }

alter table public.profiles
  add column if not exists learning_prefs jsonb not null default '{}'::jsonb;
  -- 형태: { daily_reminder: true, reminder_hour_kst: 20,
  --        inactive_reminder: true, language: "ko" }

alter table public.profiles
  add column if not exists last_seen_at timestamptz;
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

-- 3. learning_reminders_log — 알림 발송 dedup (하루 1회/유형)
create table if not exists public.learning_reminders_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('daily', 'inactive_7d', 'milestone')),
  sent_date date not null default current_date,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, reminder_type, sent_date)
);
create index if not exists learning_reminders_log_user_idx
  on public.learning_reminders_log(user_id, sent_date desc);

alter table public.learning_reminders_log enable row level security;
drop policy if exists "Admins view learning_reminders_log" on public.learning_reminders_log;
create policy "Admins view learning_reminders_log"
  on public.learning_reminders_log for select
  using (public.is_admin(auth.uid()));
