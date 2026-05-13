-- ─────────────────────────────────────────────────────────
-- 0029_governance.sql
-- v0.39.0 W12 — 전사 거버넌스 + 본부장 의존도 측정 인프라
-- ─────────────────────────────────────────────────────────

-- team_activity_log — 누가 어떤 액션을 했는지 기록 (의존도 측정용).
-- 기존 audit_log(보안 이벤트)와 별개로 운영 액션 추적.
create table if not exists public.team_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,  -- 액션 시점 역할 스냅샷
  action text not null,  -- 'beta_approve', 'sme_review', 'cost_override', 'incident_ack', 'student_message' 등
  target_type text,  -- 'beta_application', 'studio_job', 'admin_alert', 'student' 등
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_actor_idx
  on public.team_activity_log(actor_id, created_at desc);
create index if not exists team_activity_action_idx
  on public.team_activity_log(action, created_at desc);
create index if not exists team_activity_recent_idx
  on public.team_activity_log(created_at desc);

alter table public.team_activity_log enable row level security;

drop policy if exists "Admins view team_activity" on public.team_activity_log;
create policy "Admins view team_activity"
  on public.team_activity_log for select
  using (public.is_admin(auth.uid()));

-- admin_alerts에 acknowledged_by 컬럼 — 누가 위험 알림을 확인했는지
alter table public.admin_alerts
  add column if not exists acknowledged_by uuid references auth.users(id) on delete set null;

-- governance_reports — 매주 월 자동 생성된 보고서 보관
create table if not exists public.governance_reports (
  id uuid primary key default gen_random_uuid(),
  week_iso text not null,  -- 'YYYY-Www'
  payload jsonb not null,  -- 전체 보고서 데이터
  generated_at timestamptz not null default now(),
  unique(week_iso)
);

alter table public.governance_reports enable row level security;
drop policy if exists "Admins view governance_reports" on public.governance_reports;
create policy "Admins view governance_reports"
  on public.governance_reports for select
  using (public.is_admin(auth.uid()));
