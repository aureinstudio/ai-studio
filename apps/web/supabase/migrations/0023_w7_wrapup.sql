-- ─────────────────────────────────────────────────────────
-- 0023_w7_wrapup.sql
-- v0.32.0 — W7 마무리
--   • content_remediation_queue (SME 합격선 미달 자동 추적)
-- ─────────────────────────────────────────────────────────

create table if not exists public.content_remediation_queue (
  id uuid primary key default gen_random_uuid(),
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  reason text not null,                                 -- 'sme_fail_avg_lt_4.0' | 'manual'
  avg_score numeric(3, 2),
  improvements text,                                    -- SME가 남긴 개선 의견
  triggered_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'regenerating', 'regenerated', 'dismissed')),
  new_studio_job_id uuid references public.studio_jobs(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists remediation_queue_status_idx
  on public.content_remediation_queue(status, created_at desc);
create index if not exists remediation_queue_job_idx
  on public.content_remediation_queue(studio_job_id);

alter table public.content_remediation_queue enable row level security;
drop policy if exists "Admins manage remediation" on public.content_remediation_queue;
create policy "Admins manage remediation"
  on public.content_remediation_queue for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
