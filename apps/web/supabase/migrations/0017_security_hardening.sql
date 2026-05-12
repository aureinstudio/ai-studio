-- ─────────────────────────────────────────────────────────
-- 0017_security_hardening.sql
-- v0.26.0 — Production 보안 강화
--   1) is_admin() 헬퍼 함수
--   2) audit_log — 차단된 입력·의심 패턴 기록
--   3) cost_alerts — 80% 도달 알림 중복 방지 마커
--   4) cost_overrides — 본부장 수동 해제
--   5) 기존 테이블 RLS 보강 (모든 테이블 강제 활성화)
-- ─────────────────────────────────────────────────────────

-- 1. is_admin() 헬퍼 — security definer (RLS 우회로 profiles 조회)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = uid), false);
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- 2. audit_log — 보안 이벤트 (input filter·rate limit·기타 위반)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  ip text,
  blocked boolean not null default false,
  threats jsonb not null default '[]'::jsonb,
  input_preview text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_user_idx on public.audit_log(user_id, created_at desc);
create index if not exists audit_log_blocked_idx on public.audit_log(blocked, created_at desc);

alter table public.audit_log enable row level security;

-- admin만 audit_log 조회 (개인 사용자는 본인 row도 조회 불가 — 정보 노출 회피)
drop policy if exists "Admins view audit_log" on public.audit_log;
create policy "Admins view audit_log"
  on public.audit_log for select
  using (public.is_admin(auth.uid()));

-- insert는 service-role만 (API 라우트가 admin 클라이언트로 기록)
-- 일반 사용자 INSERT는 별도 정책 없음 → 차단됨

-- 3. cost_alerts — 80% 임계 도달 알림 중복 방지 (user+key+date unique)
create table if not exists public.cost_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scope_key text not null,
  alert_date date not null default current_date,
  ratio numeric(5, 4) not null,
  current_usd numeric(10, 4) not null,
  limit_usd numeric(10, 4) not null,
  created_at timestamptz not null default now(),
  unique(user_id, scope_key, alert_date)
);
create index if not exists cost_alerts_date_idx on public.cost_alerts(alert_date desc);

alter table public.cost_alerts enable row level security;

drop policy if exists "Admins view cost_alerts" on public.cost_alerts;
create policy "Admins view cost_alerts"
  on public.cost_alerts for select
  using (public.is_admin(auth.uid()));

-- 4. cost_overrides — 본부장 수동 한도 해제 (특정 user + scope_key)
create table if not exists public.cost_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create index if not exists cost_overrides_user_active_idx on public.cost_overrides(user_id, expires_at);

alter table public.cost_overrides enable row level security;

drop policy if exists "Admins manage cost_overrides" on public.cost_overrides;
create policy "Admins manage cost_overrides"
  on public.cost_overrides for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 5. RLS 강제 활성화 — 누락 가능 테이블 일괄 처리 (idempotent)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles', 'studio_jobs', 'cost_log',
      'cast_jobs', 'tutor_conversations', 'tutor_understanding_alerts',
      'consent_log', 'rag_chunks', 'samples', 'sme_evals', 'user_avatars',
      'admin_alerts', 'cast_render_progress'
    ])
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- 6. admin_alerts — admin 조회 정책 보강 (Tutor 안전 알림은 admin만)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'admin_alerts') then
    drop policy if exists "Admins view admin_alerts" on public.admin_alerts;
    create policy "Admins view admin_alerts"
      on public.admin_alerts for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- 검증 (수동 실행)
-- select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename in
--     ('profiles','studio_jobs','cost_log','cast_jobs','tutor_conversations',
--      'audit_log','cost_alerts','cost_overrides');
-- 모두 rowsecurity = true 이어야 함.
