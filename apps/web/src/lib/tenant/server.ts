/**
 * 테넌트 컨텍스트 (서버 사이드).
 *
 * 현재 사용자의 테넌트 정보를 조회. Server Component에서 호출.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  tenant_type: "internal" | "b2b_customer" | "demo";
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "active" | "suspended" | "trial" | "archived";
  branding: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
};

/**
 * 현재 로그인 사용자가 속한 테넌트 정보 반환.
 * 미로그인 또는 테넌트 없음 → null.
 *
 * cache() — 같은 request 내 중복 호출은 1회만 DB 조회.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const admin = createAdminClient();

  // 1) 서브도메인 우선 — x-tenant-slug 헤더 (proxy.ts가 주입)
  const hdrs = await headers();
  const subdomainSlug = hdrs.get("x-tenant-slug");
  if (subdomainSlug) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, slug, tenant_type, plan, status, branding, config")
      .eq("slug", subdomainSlug)
      .maybeSingle();
    if (tenant) return tenant as Tenant;
  }

  // 2) 로그인 사용자의 tenant_id (fallback)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!data?.tenant_id) return null;

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, tenant_type, plan, status, branding, config")
    .eq("id", data.tenant_id)
    .maybeSingle();

  return (tenant as Tenant | null) ?? null;
});

/**
 * 현재 사용자가 keg_super_admin인가?
 */
export const isKegSuperAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "keg_super_admin";
});
