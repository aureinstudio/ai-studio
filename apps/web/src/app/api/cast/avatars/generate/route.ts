import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAvatarImage } from "@/lib/external/gemini-image";
import { uploadTalkingPhoto } from "@/lib/external/heygen-upload";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  gender: z.enum(["male", "female"]),
  age_group: z.enum(["20s", "30s", "40s", "50s"]),
  label: z.string().min(1).max(60),
  extra_description: z.string().max(200).optional(),
});

/**
 * POST /api/cast/avatars/generate
 *
 * 흐름:
 *   1. Gemini Imagen 3 → 동양인 강사 이미지 생성 (~$0.04)
 *   2. base64 → buffer → HeyGen Talking Photo 업로드 → talking_photo_id
 *   3. 원본 이미지 Supabase Storage 백업 (private)
 *   4. user_avatars DB 저장
 *   5. cost_log 기록 (service='gemini')
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // 1. Gemini로 이미지 생성
    const generated = await generateAvatarImage({
      gender: parsed.data.gender,
      age_group: parsed.data.age_group,
      extra_description: parsed.data.extra_description,
    });

    // base64 → buffer
    const imageBuffer = Buffer.from(generated.base64, "base64");
    const contentType: "image/png" | "image/jpeg" = generated.mimeType;

    // 2. HeyGen 업로드
    const { talking_photo_id } = await uploadTalkingPhoto(imageBuffer, contentType);

    // 3. Supabase Storage 백업 (private)
    const admin = createAdminClient();
    let source_image_url: string | null = null;
    try {
      const ext = contentType === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${talking_photo_id}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("user-avatar-sources")
        .upload(path, imageBuffer, { contentType, upsert: true });
      if (!upErr) {
        const { data: signed } = await admin.storage
          .from("user-avatar-sources")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        source_image_url = signed?.signedUrl ?? null;
      }
    } catch (err) {
      console.warn("[generate-avatar] source backup failed:", err);
    }

    // 4. DB 저장
    const { data: avatar, error: dbErr } = await admin
      .from("user_avatars")
      .insert({
        user_id: user.id,
        heygen_talking_photo_id: talking_photo_id,
        label: parsed.data.label,
        gender: parsed.data.gender,
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

    // 5. 비용 로깅 (Gemini 이미지 생성 비용)
    await logCost({
      supabase,
      service: "gemini",
      endpoint: "/imagen-3.0-generate-002",
      userId: user.id,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: generated.cost_usd,
      metadata: {
        gender: parsed.data.gender,
        age_group: parsed.data.age_group,
        heygen_talking_photo_id: talking_photo_id,
      },
    });

    return NextResponse.json({
      avatar: {
        id: avatar.id,
        talking_photo_id: avatar.heygen_talking_photo_id,
        label: avatar.label,
        gender: avatar.gender,
        source_image_url: avatar.source_image_url,
        created_at: avatar.created_at,
      },
      cost_usd: generated.cost_usd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-avatar] failed:", err);
    return NextResponse.json(
      { error: "generation_failed", detail: message },
      { status: 500 },
    );
  }
}
