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
  // wildcard "*" 또는 "studio:*" 같은 prefix 매칭 허용
  const hasScope =
    key.scopes.includes("*") ||
    key.scopes.includes(requiredScope) ||
    key.scopes.some((s) => s.endsWith(":*") && requiredScope.startsWith(s.slice(0, -1)));
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

  // tenant_id 조회 (key에 직접 컬럼은 없지만 owner profile의 tenant 사용)
  // 단순화를 위해 일단 owner_user_id가 속한 tenant를 사용
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: ownerProfile } = await admin
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
