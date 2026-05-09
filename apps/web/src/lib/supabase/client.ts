import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * 사용처: Client Components, useEffect 내부, 이벤트 핸들러.
 * 키 노출: anon key (publishable)는 브라우저 노출 안전 — RLS로 권한 통제.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
