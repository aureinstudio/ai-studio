import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16+ proxy file convention (이전 이름: middleware).
 *
 * 모든 페이지·API 요청 전에 실행 — Supabase 세션 갱신 + 보호 경로 라우팅.
 * 정적 자산은 matcher에서 제외하여 불필요한 호출 방지.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
