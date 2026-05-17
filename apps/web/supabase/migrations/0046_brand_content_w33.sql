-- ─────────────────────────────────────────────────────────
-- 0046_brand_content_w33.sql
-- W33 브랜드·콘텐츠 마케팅
--
-- 추가:
--   - blog_posts        : 자체 블로그 (Studio 자체 생성 콘텐츠)
--   - content_pieces    : 블로그·유튜브·소셜 통합 게시 일정
--   - press_mentions    : PR 언급·인터뷰·발표 추적
-- ─────────────────────────────────────────────────────────

-- ═══ blog_posts ════════════════════════════════════════════
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  excerpt text,
  body_md text not null,
  cover_image_url text,
  author_id uuid references public.profiles(id) on delete set null,
  category text,                          -- 'how-to', 'case-study', 'industry', 'announcement'
  tags jsonb default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_blog_posts_published on public.blog_posts(published_at desc) where status = 'published';
create index if not exists idx_blog_posts_status on public.blog_posts(status);

alter table public.blog_posts enable row level security;
drop policy if exists "everyone reads published posts" on public.blog_posts;
create policy "everyone reads published posts" on public.blog_posts
  for select to authenticated
  using (status = 'published' or public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()) or author_id = auth.uid());
drop policy if exists "admin manages blog" on public.blog_posts;
create policy "admin manages blog" on public.blog_posts
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()) or author_id = auth.uid())
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()) or author_id = auth.uid());

-- 익명 사용자도 published 글 읽기 가능 (마케팅 페이지)
drop policy if exists "anon reads published posts" on public.blog_posts;
create policy "anon reads published posts" on public.blog_posts
  for select to anon
  using (status = 'published');

-- ═══ content_pieces (통합 콘텐츠 캘린더) ═══════════════════
create table if not exists public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  channel text not null check (channel in ('blog','youtube','instagram','linkedin','x','newsletter')),
  title text not null,
  url text,
  scheduled_date date,
  published_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','published','cancelled')),
  category text,                          -- 'demo','case-study','tutorial','announcement','industry'
  views int,
  engagement_pct numeric(5,2),
  notes text,
  studio_job_id uuid references public.studio_jobs(id) on delete set null,
  cast_job_id uuid references public.cast_jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_pieces_schedule on public.content_pieces(scheduled_date) where status in ('planned','in_progress');

alter table public.content_pieces enable row level security;
drop policy if exists "admin manages content_pieces" on public.content_pieces;
create policy "admin manages content_pieces" on public.content_pieces
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));

-- ═══ press_mentions ═══════════════════════════════════════
create table if not exists public.press_mentions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade default '00000000-0000-0000-0000-000000000001'::uuid,
  mention_type text not null check (mention_type in ('press_release','interview','article','conference_talk','podcast','case_study')),
  outlet text not null,
  title text not null,
  url text,
  published_date date,
  reach_estimate int,                     -- 도달 추정 (조회수·청중 등)
  sentiment text check (sentiment in ('positive','neutral','negative')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_press_mentions_date on public.press_mentions(published_date desc);

alter table public.press_mentions enable row level security;
drop policy if exists "admin manages press" on public.press_mentions;
create policy "admin manages press" on public.press_mentions
  for all to authenticated
  using (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()))
  with check (public.is_admin_or_ops(auth.uid()) or public.is_keg_super_admin(auth.uid()));
