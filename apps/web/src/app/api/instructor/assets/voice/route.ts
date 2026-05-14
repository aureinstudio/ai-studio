import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/mp4", "audio/x-m4a"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin", "creator"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `max ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });

  const mime = file.type || "audio/mpeg";
  if (!ALLOWED_MIME.has(mime) && !/\.(mp3|wav|m4a)$/i.test(file.name)) {
    return NextResponse.json({ error: "only mp3 / wav / m4a" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const admin = createAdminClient();

  // v0.45: Storage 업로드만. Voice Clone 등록은 v0.46에서 (HeyGen Voice Clone API 호출)
  const objectPath = `${user.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await admin.storage.from("instructor-voices").upload(objectPath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  const { error: dbErr } = await admin
    .from("instructor_assets")
    .upsert(
      {
        instructor_id: user.id,
        voice_sample_url: objectPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instructor_id" },
    );
  if (dbErr) return NextResponse.json({ error: `db: ${dbErr.message}` }, { status: 500 });

  return NextResponse.json({
    ok: true,
    message: "음성 샘플 업로드 완료. Voice Clone 등록은 v0.46에서 자동 처리됩니다.",
  });
}
