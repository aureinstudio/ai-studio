-- ─────────────────────────────────────────────────────────
-- 0021_care_ops.sql
-- v0.30.0 — 일일 운영 자동화 + 학생 케어 도구
-- ─────────────────────────────────────────────────────────

-- 1. kpi_metrics — 어제 단위 일일 KPI 스냅샷 (cron이 매일 새벽 3시 채움)
create table if not exists public.kpi_metrics (
  metric_date date primary key,
  active_students integer not null default 0,
  new_signups integer not null default 0,
  studio_jobs integer not null default 0,
  cast_jobs integer not null default 0,
  tutor_messages integer not null default 0,
  tutor_rejected integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  risk_signals integer not null default 0,
  blocked_inputs integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.kpi_metrics enable row level security;
drop policy if exists "Admins view kpi_metrics" on public.kpi_metrics;
create policy "Admins view kpi_metrics"
  on public.kpi_metrics for select
  using (public.is_admin(auth.uid()));

-- 2. student_feedback — 주 1회 자가 진단
create table if not exists public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_iso text not null,                              -- 'YYYY-Www' (ISO 주차)
  satisfaction integer not null check (satisfaction between 1 and 5),
  hardest_part text,
  tutor_helpful integer check (tutor_helpful between 1 and 5),
  comments text,
  created_at timestamptz not null default now(),
  unique(user_id, week_iso)                            -- 주 1회 강제
);
create index if not exists student_feedback_week_idx
  on public.student_feedback(week_iso, created_at desc);

alter table public.student_feedback enable row level security;
drop policy if exists "Students manage own feedback" on public.student_feedback;
create policy "Students manage own feedback"
  on public.student_feedback for all
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id);

-- 3. support_tickets — 학생 문의
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text,
  category text not null check (category in ('technical', 'content_error', 'billing', 'other')),
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_status_idx
  on public.support_tickets(status, created_at desc);
create index if not exists support_tickets_user_idx
  on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;
drop policy if exists "Students see own tickets" on public.support_tickets;
create policy "Students see own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "Students insert own tickets" on public.support_tickets;
create policy "Students insert own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id or user_id is null);
drop policy if exists "Admins manage tickets" on public.support_tickets;
create policy "Admins manage tickets"
  on public.support_tickets for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 4. content_reports — Tutor 답변 신고
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid,                                -- tutor_conversations.id
  message_index integer,                               -- conversations.messages 배열 내 위치
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  issue_type text not null check (issue_type in ('factual_error', 'inappropriate', 'incomplete', 'other')),
  detail text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution text,                                     -- 'content_fix' | 'rag_reindex' | 'no_action' | ...
  created_at timestamptz not null default now()
);
create index if not exists content_reports_unreviewed_idx
  on public.content_reports(reviewed_at) where reviewed_at is null;
create index if not exists content_reports_job_idx
  on public.content_reports(studio_job_id, created_at desc);

alter table public.content_reports enable row level security;
drop policy if exists "Users insert own reports" on public.content_reports;
create policy "Users insert own reports"
  on public.content_reports for insert
  with check (auth.uid() = user_id);
drop policy if exists "Admins manage reports" on public.content_reports;
create policy "Admins manage reports"
  on public.content_reports for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 5. care_messages_log — 자동 격려 메시지 dedup
create table if not exists public.care_messages_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null,                               -- 'inactive_3d' | 'quiz_high' | 'milestone_10h'
  sent_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, trigger, sent_date)
);
create index if not exists care_messages_log_user_idx
  on public.care_messages_log(user_id, sent_date desc);

alter table public.care_messages_log enable row level security;
drop policy if exists "Admins view care_messages_log" on public.care_messages_log;
create policy "Admins view care_messages_log"
  on public.care_messages_log for select
  using (public.is_admin(auth.uid()));
