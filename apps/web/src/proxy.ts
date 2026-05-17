import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Next.js 16+ proxy file (구 middleware).
 *
 * - Supabase 세션 갱신 + 보호 경로 라우팅
 * - /api/auth/login·signup IP-기반 brute-force 방어 (15분당 5회)
 * - 서브도메인 감지 → x-tenant-slug 헤더 주입 (v2.2)
 *
 * 솔루션 API rate limit(tutor/studio/cast)은 각 라우트 핸들러에서 직접 호출.
 */

/**
 * 호스트 헤더에서 테넌트 slug 추출.
 *
 * 예:
 *   keg.ai-studio.kr        → 'keg'
 *   acme.ai-studio.kr       → 'acme'
 *   ai-studio.kr            → null (메인 도메인)
 *   ai-studio-drab-nine.vercel.app → null (vercel 기본)
 *   localhost:3000          → null
 */
function extractTenantSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0]; // strip port
  // Production: *.ai-studio.kr (서브도메인 1개 + 메인 2개 = 3 parts)
  const parts = hostname.split(".");
  if (parts.length === 3 && hostname.endsWith("ai-studio.kr")) {
    const slug = parts[0];
    if (slug === "www" || slug === "api" || slug === "docs") return null;
    return slug;
  }
  // Dev: <slug>.localhost:3000
  if (parts.length === 2 && parts[1] === "localhost") {
    return parts[0];
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 서브도메인에서 tenant slug 추출 → 요청 헤더에 주입
  const host = request.headers.get("host");
  const tenantSlug = extractTenantSlug(host);
  if (tenantSlug) {
    request.headers.set("x-tenant-slug", tenantSlug);
  }

  if (pathname === "/api/auth/login" || pathname === "/api/auth/signup") {
    const ip = getClientIp(request);
    const rl = await checkRateLimit("auth:login", null, { ipFallback: ip });
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "rate_limit_exceeded",
          message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
          retry_after_sec: rl.retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfterSec),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        },
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
