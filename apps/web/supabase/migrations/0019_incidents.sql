-- ─────────────────────────────────────────────────────────
-- 0019_incidents.sql
-- v0.28.0 — 인시던트 추적 (ops 사이클 모니터링)
-- ─────────────────────────────────────────────────────────

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('L1', 'L2', 'L3', 'L4')),
  category text not null,
  title text not null,
  body text,
  metadata jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists incidents_created_idx on public.incidents(created_at desc);
create index if not exists incidents_level_idx on public.incidents(level, created_at desc);
create index if not exists incidents_unresolved_idx on public.incidents(resolved_at) where resolved_at is null;

alter table public.incidents enable row level security;

drop policy if exists "Admins manage incidents" on public.incidents;
create policy "Admins manage incidents"
  on public.incidents for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
