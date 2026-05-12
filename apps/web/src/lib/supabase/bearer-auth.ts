/**
 * Bearer 토큰 인증 헬퍼.
 *
 * 기본 흐름은 cookie 기반(createClient). 본 헬퍼는 fallback —
 * Authorization: Bearer <jwt> 헤더로 들어온 요청을 admin.auth.getUser(jwt)로 검증.
 *
 * 용도:
 *   - 부하 테스트 (k6 → Bearer)
 *   - 모바일/외부 통합 (cookie 미지원)
 *
 * 보안: 토큰 자체는 Supabase가 발급한 JWT(서명 검증) → service-role로 getUser 호출하면
 * 위·변조 시 null 반환. service_role를 누설하지 않음(서버 내부 호출).
 */
import { createAdminClient } from "./admin";

export type AuthedUser = { id: string; email?: string };

/**
 * cookie → Bearer 순서로 사용자 인증 시도.
 * cookieUser가 있으면 그대로 반환. 없으면 Authorization 헤더 시도.
 */
export async function resolveUser(
  request: Request,
  cookieUser: { id: string; email?: string } | null | undefined,
): Promise<AuthedUser | null> {
  if (cookieUser) return cookieUser;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}
