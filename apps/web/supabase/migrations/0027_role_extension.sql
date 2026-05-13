-- ─────────────────────────────────────────────────────────
-- 0027_role_extension.sql
-- v0.37.0 W10 — 역할 세분화 (operations, creator 추가)
-- 본부장 위임 가능한 운영팀·콘텐츠 제작자 역할 분리.
-- ─────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'sme', 'instructor', 'operations', 'creator'));

-- helper: 관리자 또는 운영팀
create or replace function public.is_admin_or_ops(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('admin', 'operations') from public.profiles where id = uid),
    false
  );
$$;
grant execute on function public.is_admin_or_ops(uuid) to authenticated;

-- helper: 강사 또는 관리자
create or replace function public.is_instructor_or_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('admin', 'instructor') from public.profiles where id = uid),
    false
  );
$$;
grant execute on function public.is_instructor_or_admin(uuid) to authenticated;
