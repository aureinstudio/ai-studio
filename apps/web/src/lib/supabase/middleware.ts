import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/studio", "/admin", "/cast", "/tutor"];
const AUTH_ONLY_PATHS = ["/login", "/signup"];

/**
 * Supabase 세션 갱신 + 보호 경로 라우팅 미들웨어.
 *
 * - 모든 요청마다 쿠키 기반 세션 갱신 (만료 임박 시 자동 refresh)
 * - 보호 경로에 미인증 접근 시 /login?next=... 으로 리다이렉트
 * - 인증된 사용자가 /login·/signup 접근 시 /dashboard 리다이렉트
 *
 * Supabase SSR 패턴 — 쿠키를 양방향(request·response)으로 동기화해야
 * 세션이 정상 유지됨.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ⚠️ 반드시 getUser() 호출 — getSession()은 신뢰 불가 (변조 가능)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
