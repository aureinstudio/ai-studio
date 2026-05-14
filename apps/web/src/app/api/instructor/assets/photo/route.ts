import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/jpg"]);

/**
 * POST /api/instructor/assets/photo
 *
 * 1. 인증·역할 확인
 * 2. instructor-photos 버킷에 업로드
 * 3. HeyGen upload API에 raw 이미지 POST → talking_photo_id 획득
 * 4. instructor_assets upsert (talking_photo_id 저장)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin", "creator"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `max ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });

  const mime = file.type || "image/jpeg";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "only image/jpeg or image/png" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const admin = createAdminClient();

  // 1) Supabase Storage
  const objectPath = `${user.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await admin.storage.from("instructor-photos").upload(objectPath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  // 2) HeyGen upload — raw binary body
  // ref: https://docs.heygen.com/reference/upload-asset
  let talkingPhotoId: string | null = null;
  try {
    const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": mime,
      },
      body: bytes,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json?.message ?? json?.error ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: `heygen upload failed: ${detail}` }, { status: 502 });
    }
    talkingPhotoId = json?.data?.talking_photo_id ?? json?.talking_photo_id ?? null;
    if (!talkingPhotoId) {
      return NextResponse.json({ error: "heygen returned no talking_photo_id", raw: json }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: `heygen network: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }

  // 3) instructor_assets upsert
  const { error: dbErr } = await admin
    .from("instructor_assets")
    .upsert(
      {
        instructor_id: user.id,
        photo_url: objectPath,
        heygen_talking_photo_id: talkingPhotoId,
        status: "registered",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instructor_id" },
    );
  if (dbErr) return NextResponse.json({ error: `db: ${dbErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, talking_photo_id: talkingPhotoId });
}
