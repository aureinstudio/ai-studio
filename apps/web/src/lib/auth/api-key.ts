/**
 * API Key 발급·해시·검증 헬퍼.
 *
 * 형식: ak_live_<32 hex>  (전체 40자) — prefix는 앞 12자 (`ak_live_xxxx`).
 * 저장: sha256 해시만 DB에 저장. 평문은 발급 시점에 단 1회만 응답.
 * 검증: Authorization: Bearer ak_live_... → prefix 인덱스로 후보 조회 → 해시 비교.
 */
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const API_KEY_PREFIX = "ak_live_";

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const body = randomBytes(16).toString("hex"); // 32 chars
  const plaintext = `${API_KEY_PREFIX}${body}`;
  const prefix = plaintext.slice(0, 12); // ak_live_xxxx
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type ApiKeyRecord = {
  id: string;
  owner_user_id: string;
  scopes: string[];
  rate_limit_per_min: number;
  monthly_cost_cap_usd: number;
  revoked_at: string | null;
};

/**
 * Bearer 토큰이 API 키일 경우 검증 후 소유자 user를 반환.
 * JWT(Supabase) 형식이면 null 반환 → 호출측에서 cookie/JWT 경로로 처리.
 */
export async function resolveApiKey(token: string): Promise<{
  key: ApiKeyRecord;
  user: { id: string; email?: string };
} | null> {
  if (!token.startsWith(API_KEY_PREFIX)) return null;

  const prefix = token.slice(0, 12);
  const hash = hashApiKey(token);

  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, owner_user_id, scopes, rate_limit_per_min, monthly_cost_cap_usd, revoked_at, key_hash")
    .eq("key_prefix", prefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (!key || key.key_hash !== hash) return null;

  // last_used_at 갱신 (fire & forget)
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email:id")
    .eq("id", key.owner_user_id)
    .maybeSingle();

  return {
    key: {
      id: key.id,
      owner_user_id: key.owner_user_id,
      scopes: (key.scopes as string[]) ?? [],
      rate_limit_per_min: key.rate_limit_per_min,
      monthly_cost_cap_usd: Number(key.monthly_cost_cap_usd),
      revoked_at: key.revoked_at,
    },
    user: { id: key.owner_user_id, email: profile?.id ? undefined : undefined },
  };
}

/**
 * 분당 호출수 + 월간 누적 비용 체크.
 * 한도 초과 시 사유 반환.
 */
export async function checkApiKeyLimits(keyId: string, capUsd: number, rpm: number): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const admin = createAdminClient();
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ count: recentCount }, { data: monthRows }] = await Promise.all([
    admin
      .from("api_key_usage")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyId)
      .gte("created_at", oneMinAgo),
    admin
      .from("api_key_usage")
      .select("cost_usd")
      .eq("api_key_id", keyId)
      .gte("created_at", monthStart),
  ]);

  if ((recentCount ?? 0) >= rpm) {
    return { ok: false, reason: `rate_limit_exceeded (${rpm}/min)` };
  }
  const monthCost = (monthRows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  if (monthCost >= capUsd) {
    return { ok: false, reason: `monthly_cost_cap_reached ($${capUsd})` };
  }
  return { ok: true };
}

export async function logApiKeyUsage(
  keyId: string,
  endpoint: string,
  statusCode: number,
  costUsd: number = 0,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("api_key_usage").insert({
    api_key_id: keyId,
    endpoint,
    status_code: statusCode,
    cost_usd: costUsd,
  });
}
