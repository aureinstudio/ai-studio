import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 매직 링크 / 이메일 확인 콜백 핸들러.
 *
 * 흐름:
 *   1. Supabase 이메일 → 사용자가 링크 클릭
 *   2. 링크: {origin}/auth/callback?code={pkce_code}&next={next}
 *   3. 본 핸들러가 code → session 교환 (PKCE)
 *   4. 성공 시 next 또는 /dashboard로 리다이렉트
 *   5. 실패 시 /login에 에러 표시
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
