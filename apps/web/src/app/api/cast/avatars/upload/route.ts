import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadTalkingPhoto } from "@/lib/external/heygen-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/cast/avatars/upload
 *
 * multipart/form-data:
 *   - image: File (jpg or png, max 10MB)
 *   - label: string (사용자 라벨, 예: "강사 김철수")
 *   - gender: "male" | "female" (선택)
 *
 * 흐름:
 *   1. 이미지 추출·검증
 *   2. HeyGen에 업로드 → talking_photo_id 획득
 *   3. user_avatars 테이블에 저장
 *   4. (선택) 원본 사진 Supabase Storage 백업
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("image");
  const label = String(formData.get("label") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const gender =
    genderRaw === "male" || genderRaw === "female" ? genderRaw : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label_required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "file_too_large", max_mb: 10 },
      { status: 400 },
    );
  }

  const contentType: "image/jpeg" | "image/png" =
    file.type === "image/png" ? "image/png" : "image/jpeg";
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return NextResponse.json(
      { error: "invalid_format", allowed: ["image/jpeg", "image/png"] },
      { status: 400 },
    );
  }

  try {
    // 1. HeyGen 업로드
    const buffer = await file.arrayBuffer();
    const { talking_photo_id } = await uploadTalkingPhoto(buffer, contentType);

    // 2. Supabase Storage에 원본 백업 (선택, 실패해도 진행)
    const admin = createAdminClient();
    let source_image_url: string | null = null;
    try {
      const ext = contentType === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${talking_photo_id}.${ext}`;
      const { error: uploadErr } = await admin.storage
        .from("user-avatar-sources")
        .upload(path, Buffer.from(buffer), {
          contentType,
          upsert: true,
        });
      if (!uploadErr) {
        // private 버킷이므로 signed URL — 1년 유효
        const { data: signed } = await admin.storage
          .from("user-avatar-sources")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        source_image_url = signed?.signedUrl ?? null;
      }
    } catch (err) {
      console.warn("[upload-avatar] source backup failed (non-fatal):", err);
    }

    // 3. DB 저장
    const { data: avatar, error: dbErr } = await admin
      .from("user_avatars")
      .insert({
        user_id: user.id,
        heygen_talking_photo_id: talking_photo_id,
        label,
        gender,
        source_image_url,
      })
      .select("id, heygen_talking_photo_id, label, gender, source_image_url, created_at")
      .single();

    if (dbErr || !avatar) {
      return NextResponse.json(
        { error: "db_insert_failed", detail: dbErr?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      avatar: {
        id: avatar.id,
        talking_photo_id: avatar.heygen_talking_photo_id,
        label: avatar.label,
        gender: avatar.gender,
        source_image_url: avatar.source_image_url,
        created_at: avatar.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload-avatar] failed:", err);
    return NextResponse.json(
      { error: "heygen_upload_failed", detail: message },
      { status: 500 },
    );
  }
}
