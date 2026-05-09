import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Server Components · Route Handlers · Server Actions).
 *
 * cookies() Next 15+에서 async — 본 함수도 async.
 * Server Component에서 setAll 호출은 무시되며 (read-only), Route Handler/Action에서는 정상 작동.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출 — 무시 (middleware가 세션 갱신 담당)
          }
        },
      },
    },
  );
}
