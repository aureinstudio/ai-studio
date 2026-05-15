/**
 * Public API v1 인증 미들웨어.
 *
 * Authorization: Bearer ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * 동작:
 *   1. Authorization 헤더에서 Bearer 추출
 *   2. resolveApiKey로 검증 + 사용량 한도 확인
 *   3. scope 체크 (필수 권한이 키에 있는가)
 *   4. rate limit 적용
 *
 * 실패 시 NextResponse 직접 반환 → 라우트 핸들러에서 if (error) return error
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveApiKey, checkApiKeyLimits, logApiKeyUsage } from "@/lib/auth/api-key";
import type { ApiKeyRecord } from "@/lib/auth/api-key";

export type ApiV1Context = {
  key: ApiKeyRecord;
  userId: string;
  tenantId: string | null;
};

export type ApiV1GuardResult =
  | { ok: true; ctx: ApiV1Context }
  | { ok: false; response: NextResponse };

/**
 * scope 예: "studio:write", "tutor:read", "cast:write"
 */
export async function authenticateApiV1(
  request: NextRequest,
  requiredScope: string,
): Promise<ApiV1GuardResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_authorization", message: "Authorization: Bearer <key> header required" },
        { status: 401 },
      ),
    };
  }

  const resolved = await resolveApiKey(token);
  if (!resolved) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_api_key", message: "Key not found, revoked, or expired" },
        { status: 401 },
      ),
    };
  }
  const { key, user } = resolved;

  // scope 체크 — 키에 명시된 권한 안에 requiredScope가 있어야 함
  // 허용:
  //   "*"                  : 모든 권한
  //   "studio:write"       : 정확 일치
  //   "studio:*"           : 같은 리소스 전체 권한
  //   "studio"             : (간편) 리소스만 명시 시 :write/:read 모두 허용
  const [resource] = requiredScope.split(":");

  // owner가 keg_super_admin 또는 admin이면 scope 검사 우회 (시연·테스트)
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();
  const { data: ownerRole } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", key.owner_user_id)
    .maybeSingle();
  const isOwnerAdmin = ownerRole?.role === "keg_super_admin" || ownerRole?.role === "admin";

  const hasScope =
    isOwnerAdmin ||
    key.scopes.includes("*") ||
    key.scopes.includes(requiredScope) ||
    key.scopes.includes(`${resource}:*`) ||
    key.scopes.includes(resource);
  if (!hasScope) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "insufficient_scope", required: requiredScope, granted: key.scopes },
        { status: 403 },
      ),
    };
  }

  // rate limit + 월 비용 한도
  const limit = await checkApiKeyLimits(key.id, key.monthly_cost_cap_usd, key.rate_limit_per_min);
  if (!limit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "rate_limit_or_quota_exceeded", reason: limit.reason },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  }

  // tenant_id 조회 (owner profile의 tenant 사용) — 위에서 만든 adminClient 재사용
  const { data: ownerProfile } = await adminClient
    .from("profiles")
    .select("tenant_id")
    .eq("id", key.owner_user_id)
    .maybeSingle();

  return {
    ok: true,
    ctx: {
      key,
      userId: user.id,
      tenantId: ownerProfile?.tenant_id ?? null,
    },
  };
}

/**
 * 라우트 종료 시 사용 로그 기록 (cost 추적용).
 */
export async function recordApiUsage(
  ctx: ApiV1Context,
  endpoint: string,
  statusCode: number,
  costUsd: number = 0,
): Promise<void> {
  await logApiKeyUsage(ctx.key.id, endpoint, statusCode, costUsd);
}
