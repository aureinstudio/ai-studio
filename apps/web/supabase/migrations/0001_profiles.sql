-- ─────────────────────────────────────────────────────────
-- 0001_profiles.sql — User profiles + role + auto-creation trigger
-- 실행: Supabase Dashboard → SQL Editor → New query → 본 파일 전체 붙여넣기 → Run
-- 멱등성: 다시 실행해도 안전 (drop if exists 패턴)
-- ─────────────────────────────────────────────────────────

-- 1. profiles 테이블
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. RLS 활성화
alter table public.profiles enable row level security;

-- 4. RLS 정책: 본인 프로필 조회
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 5. RLS 정책: 본인 프로필 수정 (단, role은 트리거로 보호)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. role 변경 가드 — 클라이언트 self-escalation만 차단
-- 서버 측 컨텍스트 (SQL Editor·service_role·마이그레이션)는 허용
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role text;
  caller_uid uuid;
begin
  -- role 변경 없으면 통과 (NULL 비교 안전)
  if new.role is not distinct from old.role then
    return new;
  end if;

  caller_uid := auth.uid();

  -- 서버 측 컨텍스트 — auth.uid()는 JWT 있는 클라이언트만 set됨
  -- SQL Editor·service_role·마이그레이션은 NULL → 허용
  if caller_uid is null then
    return new;
  end if;

  -- 클라이언트 컨텍스트 — admin 권한 필수
  select role into caller_role from public.profiles where id = caller_uid;
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'role 필드는 admin만 변경할 수 있습니다';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_self_escalation on public.profiles;
create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- 7. auth.users 신규 가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. 인덱스 (email 조회 가속)
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);

-- 검증 쿼리 (실행 후 수동 확인용 — 주석 해제해서 SELECT만 실행)
-- select count(*) from public.profiles;  -- 0이어야 함 (가입 전)
-- select tablename, rowsecurity from pg_tables where tablename = 'profiles';  -- rowsecurity = true
