-- ─────────────────────────────────────────────────────────
-- 0047_global_w35.sql
-- W35 글로벌 시장 검토 (실행 X — 분석 자료)
-- ─────────────────────────────────────────────────────────

create table if not exists public.global_markets (
  id uuid primary key default gen_random_uuid(),
  region text not null,                          -- 'southeast_asia','china_zone','japan','english'
  country text not null,
  country_code text not null,                    -- ISO 3166-1 alpha-2
  population_m numeric,                          -- 백만 단위
  k_wave_index int,                              -- 1-10 (한류 영향력)
  market_size_usd_m bigint,                      -- 교육 시장 추정 (USD M)
  primary_demand text,                           -- 'korean_lang','certification','esl','k_content'
  competition_level text check (competition_level in ('low','medium','high')),
  entry_cost_krw bigint,                         -- 1국 진출 추정 비용
  notes text,
  recorded_at timestamptz not null default now(),
  unique (country_code)
);

alter table public.global_markets enable row level security;
drop policy if exists "admin reads global markets" on public.global_markets;
create policy "admin reads global markets" on public.global_markets
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

-- 시드 데이터 — 산업 리서치 추정값 (이사회 자료용 — 정밀 검증 필요)
insert into public.global_markets (region, country, country_code, population_m, k_wave_index, market_size_usd_m, primary_demand, competition_level, entry_cost_krw, notes)
values
  ('southeast_asia', '베트남', 'VN', 100, 9, 800, 'korean_lang', 'medium', 500000000, '한국어 시험 TOPIK 응시자 매년 5만+. KEG 한식 자격증 즉시 통할 가능성.'),
  ('southeast_asia', '인도네시아', 'ID', 280, 8, 1200, 'korean_lang', 'medium', 700000000, '인구 최대. K-팝/K-드라마 영향 큼. 결제·로컬화 복잡.'),
  ('southeast_asia', '태국', 'TH', 70, 8, 500, 'korean_lang', 'medium', 400000000, '한국 유학 수요 꾸준. 한국어 학원 다수.'),
  ('china_zone', '대만', 'TW', 24, 9, 600, 'k_content', 'medium', 350000000, 'K-콘텐츠 친화. 자격증 시장 안정.'),
  ('china_zone', '홍콩', 'HK', 7, 7, 250, 'certification', 'high', 500000000, '영어권. ESL 시장 동시 진입 가능. 임대료 높음.'),
  ('japan', '일본', 'JP', 124, 7, 2500, 'korean_lang', 'high', 1000000000, '한국어 학습자 100만+. 동시에 KEG는 일본어 강좌도 가능 (양방향).'),
  ('english', '미국', 'US', 333, 5, 8500, 'esl', 'high', 1500000000, 'ESL 시장 거대. 경쟁 매우 치열 (Duolingo·Coursera).'),
  ('english', '영국', 'GB', 67, 5, 1800, 'esl', 'high', 800000000, '유럽 진출 헤드쿼터로 활용 가능. 진입 비용 높음.')
on conflict (country_code) do nothing;

-- 시나리오별 글로벌 ROI 추정
create table if not exists public.global_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_name text not null,
  description text,
  target_countries jsonb not null,               -- ['VN','ID',...]
  investment_krw bigint not null,
  projected_revenue_12m_krw bigint,
  projected_revenue_24m_krw bigint,
  projected_revenue_36m_krw bigint,
  expected_students_24m int,
  risks text,
  created_at timestamptz not null default now()
);

alter table public.global_scenarios enable row level security;
drop policy if exists "admin manages scenarios" on public.global_scenarios;
create policy "admin manages scenarios" on public.global_scenarios
  for all to authenticated
  using (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_keg_super_admin(auth.uid()) or public.is_admin(auth.uid()));

insert into public.global_scenarios (scenario_name, description, target_countries, investment_krw, projected_revenue_12m_krw, projected_revenue_24m_krw, projected_revenue_36m_krw, expected_students_24m, risks)
values
  ('보수적 — 베트남 단독', '베트남 1국 진출, 한국어·한국 자격증 특화', '["VN"]'::jsonb, 500000000, 200000000, 1500000000, 4000000000, 8000, '베트남 결제·법무 리스크. 현지 파트너 필수.'),
  ('중간 — 동남아 3국', '베트남·인도네시아·태국 동시 진출 (한류 영향 큰 권역)', '["VN","ID","TH"]'::jsonb, 1500000000, 600000000, 5000000000, 13000000000, 25000, '운영 복잡도 ↑. 현지 인력 채용 필수.'),
  ('적극적 — 동남아 + 일본', '동남아 3국 + 일본 (양방향 한·일 교육)', '["VN","ID","TH","JP"]'::jsonb, 2800000000, 1000000000, 9000000000, 25000000000, 45000, '일본 진입 비용 큼. 현지 협력사 확보 필수.'),
  ('전략적 — 일본 단독 우선', '일본 1국 집중. 한국어 학습자 100만+ 타깃', '["JP"]'::jsonb, 1000000000, 400000000, 3500000000, 9000000000, 18000, '경쟁 치열. 차별화 필수. 일본어 콘텐츠 역수출 가능.')
on conflict do nothing;
