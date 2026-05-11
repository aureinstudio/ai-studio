import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage 업로드 헬퍼.
 * service-role 클라이언트 (createAdminClient) 사용 시 RLS 우회.
 *
 * 버킷:
 * - cast-audio: 음성 파일 (mp3)
 * - cast-video: 영상 파일 (mp4)
 * - cast-captions: 자막 파일 (srt, json)
 */
export type StorageBucket = "cast-audio" | "cast-video" | "cast-captions" | "studio-pptx";

export async function uploadToStorage(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string,
  data: ArrayBuffer | Buffer | string,
  contentType: string,
): Promise<{ url: string; path: string }> {
  const body = typeof data === "string" ? data : Buffer.isBuffer(data) ? data : Buffer.from(data);
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload [${bucket}/${path}] failed: ${error.message}`);

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: publicData.publicUrl, path };
}

/**
 * URL 추출 (이미 업로드된 파일).
 */
export function getPublicUrl(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string,
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
