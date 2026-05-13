/**
 * Supabase mutation 보호 helper.
 *
 * 배경: Supabase REST가 타입 불일치(예: float→INT4) 등으로 update를 silently
 * reject하는 케이스 발생. `.update(...).eq(...)` 결과의 `error`를 폐기하면
 * 영영 디버깅 불가. (실제 사고: cast_jobs.duration_seconds float 전송으로
 * cost·video_url·status 모두 영영 0으로 남음 — 30분 디버깅 소요.)
 *
 * 사용:
 *   await guarded(admin.from("cast_jobs").update({...}).eq("id", x));
 *   await guarded(admin.from("cast_jobs").insert({...}));
 *
 * error가 있으면 throw — 호출처가 명시적으로 try/catch로 다루도록 강제.
 */

type SupabaseQueryResult = Promise<{ error: { message: string; code?: string } | null }>;

export async function guarded<T extends SupabaseQueryResult>(
  query: T,
  context: string = "supabase mutation",
): Promise<Awaited<T>> {
  const result = await query;
  if (result.error) {
    const msg = result.error.message;
    const code = result.error.code ? ` [${result.error.code}]` : "";
    throw new Error(`${context}${code}: ${msg}`);
  }
  return result as Awaited<T>;
}
