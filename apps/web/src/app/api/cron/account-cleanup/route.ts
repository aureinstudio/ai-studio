import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCronResult } from "@/lib/notifications/slack";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Vercel Cron — 일일 계정 정리.
 *
 * 30일 유예 만료된 profiles 자동 hard-delete.
 * deletion_scheduled_at <= now() AND deletion_scheduled_at IS NOT NULL
 *
 * Supabase Auth User 삭제 → profiles FK ON DELETE CASCADE → 모든 관련 데이터 자동 삭제
 *   (studio_jobs · cast_jobs · tutor_conversations · tutor_understanding · user_avatars 등)
 *
 * 스케줄: 매일 18:00 UTC = 03:00 KST (저트래픽 시간)
 * 보안: Authorization: Bearer ${CRON_SECRET} 헤더 검증
 */
export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 만료된 계정 조회
  const { data: expired, error } = await admin
    .from("profiles")
    .select("id, email, deletion_requested_at, deletion_scheduled_at")
    .lte("deletion_scheduled_at", now)
    .not("deletion_scheduled_at", "is", null);

  if (error) {
    await notifyCronResult({
      job_name: "account-cleanup",
      status: "failed",
      summary: `조회 실패: ${error.message}`,
    });
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  const targets = expired ?? [];
  const results: { id: string; email: string; ok: boolean; error?: string }[] = [];

  for (const profile of targets) {
    try {
      // Supabase Auth User 삭제 (cascade로 profiles + 관련 모든 테이블 삭제)
      const { error: deleteErr } = await admin.auth.admin.deleteUser(profile.id);
      if (deleteErr) {
        results.push({ id: profile.id, email: profile.email, ok: false, error: deleteErr.message });
        continue;
      }
      results.push({ id: profile.id, email: profile.email, ok: true });
    } catch (err) {
      results.push({
        id: profile.id,
        email: profile.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  // Slack 보고
  if (targets.length > 0) {
    await notifyCronResult({
      job_name: "account-cleanup",
      status: failed === 0 ? "success" : failed === targets.length ? "failed" : "warning",
      summary: `30일 유예 만료 계정 처리: ${ok}건 삭제, ${failed}건 실패 (총 ${targets.length}건)`,
      details:
        failed > 0
          ? [
              {
                title: "실패 상세",
                value: results
                  .filter((r) => !r.ok)
                  .slice(0, 5)
                  .map((r) => `• ${r.email.slice(0, 30)}: ${r.error?.slice(0, 100)}`)
                  .join("\n"),
              },
            ]
          : undefined,
    });
  }

  return NextResponse.json({
    processed: targets.length,
    deleted: ok,
    failed,
    results: results.map((r) => ({ id: r.id, ok: r.ok })),
  });
}
