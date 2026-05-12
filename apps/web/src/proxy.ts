import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Next.js 16+ proxy file (구 middleware).
 *
 * - Supabase 세션 갱신 + 보호 경로 라우팅
 * - /api/auth/login·signup IP-기반 brute-force 방어 (15분당 5회)
 *
 * 솔루션 API rate limit(tutor/studio/cast)은 각 라우트 핸들러에서 직접 호출.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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
