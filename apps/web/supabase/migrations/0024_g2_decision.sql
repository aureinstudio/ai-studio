-- ─────────────────────────────────────────────────────────
-- 0024_g2_decision.sql
-- v0.33.0 — W8 Gate G2 의사결정 자료
-- ─────────────────────────────────────────────────────────

-- 1. decision_log — 영구 의사결정 기록
create table if not exists public.decision_log (
  id uuid primary key default gen_random_uuid(),
  gate_id text not null,                              -- 'G2' | 'G3' | ...
  decision text not null check (decision in ('GO', 'HOLD', 'NO-GO')),
  decided_by uuid references auth.users(id) on delete set null,
  attendees jsonb,                                    -- [{name, role}, ...]
  rationale text not null,
  next_actions text,
  kpi_snapshot jsonb,                                 -- 결정 시점 KPI 동결
  decided_at timestamptz not null default now()
);
create index if not exists decision_log_gate_idx
  on public.decision_log(gate_id, decided_at desc);

alter table public.decision_log enable row level security;
drop policy if exists "Admins manage decisions" on public.decision_log;
create policy "Admins manage decisions"
  on public.decision_log for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2. retrospective_entries — 4주 회고 (TF 8명 자유 입력)
create table if not exists public.retrospective_entries (
  id uuid primary key default gen_random_uuid(),
  gate_id text not null,
  category text not null check (category in ('went_well', 'tough', 'do_differently')),
  content text not null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists retro_gate_cat_idx
  on public.retrospective_entries(gate_id, category, created_at desc);

alter table public.retrospective_entries enable row level security;
drop policy if exists "Admins view retro" on public.retrospective_entries;
create policy "Admins view retro"
  on public.retrospective_entries for select
  using (public.is_admin(auth.uid()));
drop policy if exists "Admins insert retro" on public.retrospective_entries;
create policy "Admins insert retro"
  on public.retrospective_entries for insert
  with check (public.is_admin(auth.uid()) or auth.uid() = author_id);
drop policy if exists "Authors delete own retro" on public.retrospective_entries;
create policy "Authors delete own retro"
  on public.retrospective_entries for delete
  using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- 3. beta_end_choices — 베타 종료 시 학생 선택
create table if not exists public.beta_end_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('continue_full', 'delete_all', 'anonymous_stats_only')),
  note text,
  chosen_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(user_id)
);

alter table public.beta_end_choices enable row level security;
drop policy if exists "Students manage own choice" on public.beta_end_choices;
create policy "Students manage own choice"
  on public.beta_end_choices for all
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id);
