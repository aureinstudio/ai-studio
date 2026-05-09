import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase 클라이언트 — *서버 백그라운드 작업 전용*.
 *
 * ⚠️ 절대 클라이언트 컴포넌트·Edge runtime·브라우저 노출 금지.
 *    이 키는 RLS를 *우회*하므로 누설 시 DB 전체 접근 위험.
 *
 * 사용처:
 *   - after() 백그라운드 콜백 (요청 라이프사이클 외부 — cookies 불가)
 *   - 백그라운드 작업 (cron·webhook 처리)
 *   - 마이그레이션·시드 스크립트
 *
 * 사용하지 말 것:
 *   - 사용자 요청 처리 (대신 server.ts의 createClient — 쿠키 + RLS)
 *   - 클라이언트 컴포넌트 (대신 client.ts의 createClient)
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
