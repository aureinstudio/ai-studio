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

  // 1) Supabase Storage
  const objectPath = `${user.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await admin.storage.from("instructor-voices").upload(objectPath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  // 2) HeyGen Voice Library — Instant Voice Cloning
  //    HeyGen API: POST /v1/voice/list (조회용) 만 공개. Voice Cloning은 대시보드 OR Enterprise API.
  //    공개 API 미지원 케이스 → storage만 저장 + 메시지 안내.
  const apiKey = process.env.HEYGEN_API_KEY;
  let voiceId: string | null = null;
  let cloneNote = "음성 샘플 업로드 완료.";

  if (apiKey) {
    try {
      // 시도: HeyGen Voice 업로드 (Enterprise/Creator 플랜)
      // ref: https://docs.heygen.com/reference/upload-asset (audio 지원)
      const upRes = await fetch("https://upload.heygen.com/v1/asset", {
        method: "POST",
        headers: { "X-Api-Key": apiKey, "Content-Type": mime },
        body: bytes,
      });
      const upJson = await upRes.json().catch(() => ({}));
      if (upRes.ok && upJson?.data?.id) {
        // 자산 등록 성공 → voice clone 요청 시도
        const cloneRes = await fetch("https://api.heygen.com/v1/instant_voice_clone", {
          method: "POST",
          headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Instructor_${user.id.slice(0, 8)}`,
            asset_id: upJson.data.id,
            language: "ko",
          }),
        });
        const cloneJson = await cloneRes.json().catch(() => ({}));
        if (cloneRes.ok && (cloneJson?.data?.voice_id || cloneJson?.voice_id)) {
          voiceId = cloneJson?.data?.voice_id ?? cloneJson?.voice_id;
          cloneNote = `Voice Clone 등록 완료 (voice_id: ${voiceId!.slice(0, 12)}...)`;
        } else {
          cloneNote = `샘플 업로드 완료. Voice Clone 미지원 응답 (HTTP ${cloneRes.status}). HeyGen 대시보드에서 수동 클론 후 본부장에게 voice_id 전달 요청.`;
        }
      } else {
        cloneNote = `샘플 업로드 완료. HeyGen 자산 업로드 실패 (${upRes.status}). HeyGen 대시보드에서 수동 클론하세요.`;
      }
    } catch (e) {
      cloneNote = `샘플 업로드 완료. HeyGen 네트워크 오류: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  // 3) instructor_assets upsert
  const { error: dbErr } = await admin
    .from("instructor_assets")
    .upsert(
      {
        instructor_id: user.id,
        voice_sample_url: objectPath,
        heygen_voice_id: voiceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instructor_id" },
    );
  if (dbErr) return NextResponse.json({ error: `db: ${dbErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, message: cloneNote, voice_id: voiceId });
}
