-- ─────────────────────────────────────────────────────────
-- 0042_expand_w21.sql
-- W21 EXPAND — 5 → 10 과정 확장 인프라
--
-- 추가:
--   - course_catalog        : 과정 슬롯 + 마이그레이션 진척 추적
--   - referral_codes        : 추천 코드 + 사용 카운트
--   - referral_uses         : 추천 사용 이력
--   - instructor_recruitment: 강사 영입 파이프라인
-- ─────────────────────────────────────────────────────────

-- ═══ course_catalog ════════════════════════════════════════
-- 10개 과정 슬롯 — 기존 5 + 신규 5 (자격증 2 + 일반 3)
create table if not exists public.course_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  slug text not null,
  name text not null,
  course_category text not null check (course_category in ('certification','professional','language','hobby','academic')),
  status text not null default 'planned'
    check (status in ('planned','content_migration','sme_review','beta','live','retired')),
  target_students int,
  primary_instructor_id uuid references public.profiles(id) on delete set null,
  migration_progress_pct int not null default 0 check (migration_progress_pct between 0 and 100),
  planned_launch_date date,
  actual_launch_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_course_catalog_tenant on public.course_catalog(tenant_id, status);

alter table public.course_catalog enable row level security;
drop policy if exists "tenant manages course_catalog" on public.course_catalog;
create policy "tenant manages course_catalog" on public.course_catalog
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  );

-- KEG 5개 과정 시드 (이미 운영 중)
insert into public.course_catalog (slug, name, course_category, status, target_students, migration_progress_pct)
values
  ('certification-cook', '조리기능사 자격증', 'certification', 'live', 100, 100),
  ('professional-react', 'React 개발자 직무', 'professional', 'live', 80, 100),
  ('language-business-english', '비즈니스 영어', 'language', 'live', 60, 100),
  ('hobby-baking', '홈베이킹', 'hobby', 'live', 50, 100),
  ('academic-suneung-korean', '수능 국어', 'academic', 'live', 80, 100)
on conflict (tenant_id, slug) do nothing;

-- W21 신규 5개 과정 시드 (계획 단계)
insert into public.course_catalog (slug, name, course_category, status, target_students, migration_progress_pct, planned_launch_date, notes)
values
  ('certification-info-processor', '정보처리기사', 'certification', 'planned', 100, 0, current_date + 60, 'W21 신규 — 자격증 추가 1'),
  ('certification-real-estate', '공인중개사', 'certification', 'planned', 100, 0, current_date + 60, 'W21 신규 — 자격증 추가 2'),
  ('professional-marketing', '디지털 마케팅 직무', 'professional', 'planned', 80, 0, current_date + 45, 'W21 신규 — 일반 1'),
  ('language-japanese-jlpt', '일본어 JLPT N3', 'language', 'planned', 60, 0, current_date + 75, 'W21 신규 — 일반 2'),
  ('academic-suneung-math', '수능 수학', 'academic', 'planned', 80, 0, current_date + 90, 'W21 신규 — 일반 3')
on conflict (tenant_id, slug) do nothing;

-- ═══ referral_codes ════════════════════════════════════════
-- 추천 코드 (학생·강사 모두 발급 가능 — 사용 시 인센티브)
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  reward_krw int not null default 30000,        -- 추천 1건당 owner 보상
  discount_pct int not null default 10,          -- 신규 학생 할인율
  expires_at timestamptz,
  enabled boolean not null default true,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_codes_owner on public.referral_codes(owner_user_id);

alter table public.referral_codes enable row level security;
drop policy if exists "owner manages referral_codes" on public.referral_codes;
create policy "owner manages referral_codes" on public.referral_codes
  for all to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    owner_user_id = auth.uid()
    or public.is_keg_super_admin(auth.uid())
  );

-- ═══ referral_uses ═════════════════════════════════════════
create table if not exists public.referral_uses (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.referral_codes(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  reward_paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code_id, referred_user_id)
);
create index if not exists idx_referral_uses_code on public.referral_uses(code_id);

alter table public.referral_uses enable row level security;
drop policy if exists "admin reads referral_uses" on public.referral_uses;
create policy "admin reads referral_uses" on public.referral_uses
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or public.is_admin_or_ops(auth.uid())
    or exists (
      select 1 from public.referral_codes c
      where c.id = referral_uses.code_id and c.owner_user_id = auth.uid()
    )
  );

-- ═══ instructor_recruitment ════════════════════════════════
create table if not exists public.instructor_recruitment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  candidate_name text not null,
  candidate_email text,
  target_course_slug text,
  source text,                          -- 'referral', 'job_post', 'direct'
  stage text not null default 'sourcing'
    check (stage in ('sourcing','interview','offer','onboarded','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_recruitment_tenant_stage on public.instructor_recruitment(tenant_id, stage);

alter table public.instructor_recruitment enable row level security;
drop policy if exists "admin manages recruitment" on public.instructor_recruitment;
create policy "admin manages recruitment" on public.instructor_recruitment
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_admin_or_ops(auth.uid()))
  );
