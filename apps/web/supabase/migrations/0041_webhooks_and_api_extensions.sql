-- ─────────────────────────────────────────────────────────
-- 0041_webhooks_and_api_extensions.sql
-- Phase 4 W19 — Public API + Webhooks (PR-A)
--
-- 추가:
--   - webhook_endpoints     : 테넌트가 등록한 webhook URL
--   - webhook_deliveries    : 발송 로그 + 재시도 추적
-- ─────────────────────────────────────────────────────────

-- ═══ webhook_endpoints ════════════════════════════════════
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text,
  url text not null check (url ~* '^https?://'),
  events jsonb not null default '[]'::jsonb,   -- 예: ['studio.completed','cast.completed','tutor.flagged']
  secret text not null,                         -- HMAC SHA256 sign용 (whsec_...)
  enabled boolean not null default true,
  failure_count int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_endpoints_tenant on public.webhook_endpoints(tenant_id) where enabled = true;

alter table public.webhook_endpoints enable row level security;

drop policy if exists "tenant manages webhooks" on public.webhook_endpoints;
create policy "tenant manages webhooks" on public.webhook_endpoints
  for all to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  )
  with check (
    public.is_keg_super_admin(auth.uid())
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin(auth.uid(), tenant_id))
  );

-- ═══ webhook_deliveries (발송 로그) ════════════════════════
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status_code int,
  response_body text,
  error text,
  attempt int not null default 1,
  delivered_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_deliveries_endpoint on public.webhook_deliveries(endpoint_id, created_at desc);
create index if not exists idx_webhook_deliveries_retry on public.webhook_deliveries(next_retry_at) where delivered_at is null and next_retry_at is not null;

alter table public.webhook_deliveries enable row level security;

drop policy if exists "tenant reads webhook deliveries" on public.webhook_deliveries;
create policy "tenant reads webhook deliveries" on public.webhook_deliveries
  for select to authenticated
  using (
    public.is_keg_super_admin(auth.uid())
    or exists (
      select 1 from public.webhook_endpoints e
      where e.id = webhook_deliveries.endpoint_id
        and e.tenant_id = public.current_tenant_id()
        and public.is_tenant_admin(auth.uid(), e.tenant_id)
    )
  );
