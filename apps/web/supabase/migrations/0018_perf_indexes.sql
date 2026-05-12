-- ─────────────────────────────────────────────────────────
-- 0018_perf_indexes.sql
-- v0.27.0 — 부하 최적화용 인덱스 보강
-- cost-guard 다층 합산, 대화 활성도 정렬, 잡 필터링 가속.
-- 모두 idempotent.
-- ─────────────────────────────────────────────────────────

-- cost-guard sumCost: WHERE user_id=$1 AND service=$2 AND created_at >= $3
create index if not exists cost_log_user_service_created_idx
  on public.cost_log(user_id, service, created_at desc);

-- cost-monitor cron: WHERE created_at >= $1 (전역 일·주 합산)
create index if not exists cost_log_created_idx
  on public.cost_log(created_at desc);

-- tutor_conversations: 최근 활성 대화 조회 (admin·학생 대시보드)
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tutor_conversations') then
    create index if not exists idx_tutor_conv_student_active
      on public.tutor_conversations(student_id, last_active_at desc);
    create index if not exists idx_tutor_conv_active
      on public.tutor_conversations(last_active_at desc);
  end if;
end $$;

-- studio_jobs: 상태별 사용자 잡 (히스토리 페이지)
create index if not exists studio_jobs_user_status_created_idx
  on public.studio_jobs(user_id, status, created_at desc);

-- cast_jobs: rendering 상태 폴링 (webhook 매칭 보조)
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='cast_jobs') then
    create index if not exists idx_cast_jobs_status_user
      on public.cast_jobs(status, user_id, created_at desc);
  end if;
end $$;

-- audit_log: 보안 페이지 조회 가속 (endpoint별·blocked별)
create index if not exists audit_log_endpoint_idx
  on public.audit_log(endpoint, created_at desc);

-- planner 통계 갱신 — 인덱스 추가 후 즉시 효과
analyze public.cost_log;
analyze public.studio_jobs;
analyze public.audit_log;
