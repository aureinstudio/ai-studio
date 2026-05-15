-- ─────────────────────────────────────────────────────────
-- 0040_demo_tenant_and_super_admin.sql
-- Phase 4 PR-4 — Demo 테넌트 추가 + keg_super_admin 1명 지정
--
-- 본부장(aureinstudio@gmail.com)을 keg_super_admin으로 승격해서
-- /super-admin 페이지 접근 + 모든 테넌트 데이터 조회 가능하게.
-- ─────────────────────────────────────────────────────────

-- Demo 테넌트 추가 (B2B 영업 시연용 빈 환경)
insert into public.tenants (id, name, slug, tenant_type, plan, max_students, max_courses, status, branding)
values (
  '00000000-0000-0000-0000-000000000002',
  'Demo Customer',
  'demo',
  'demo',
  'pro',
  100,
  3,
  'trial',
  jsonb_build_object(
    'primary_color', '#0ea5e9',
    'accent_color', '#22d3ee',
    'logo_text', 'Demo'
  )
)
on conflict (id) do nothing;

-- 본부장 계정을 keg_super_admin으로 승격
-- ⚠ 이메일이 다르면 본부장이 직접 SQL 수정 후 재실행
update public.profiles
set role = 'keg_super_admin'
where email = 'aureinstudio@gmail.com';

-- 확인
do $$
declare
  super_count int;
begin
  select count(*) into super_count from public.profiles where role = 'keg_super_admin';
  if super_count = 0 then
    raise warning '[0040] keg_super_admin 사용자 없음 — aureinstudio@gmail.com 이메일 확인 필요. 수동으로 다른 이메일 지정.';
  else
    raise notice '[0040] keg_super_admin 사용자 수: %', super_count;
  end if;
end $$;
