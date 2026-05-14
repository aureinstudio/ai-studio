import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PhotoUpload from "./photo-upload";
import VoiceUpload from "./voice-upload";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/assets");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin", "creator"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: assets } = await admin
    .from("instructor_assets")
    .select("photo_url, voice_sample_url, heygen_talking_photo_id, heygen_voice_id, status, updated_at")
    .eq("instructor_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">강사 자산 등록</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          사진 1장 + 음성 샘플 30초~3분을 등록하면 Studio Pro 영상 합성 시 본인 얼굴·목소리로 출력됩니다.
          등록은 1회만 하면 모든 작업에 자동 적용됩니다.
        </p>
      </header>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">사진 (talking_photo)</h2>
        {assets?.heygen_talking_photo_id ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <div className="font-semibold text-emerald-800">✓ 등록 완료</div>
            <div className="mt-1 font-mono text-xs text-emerald-700">talking_photo_id: {assets.heygen_talking_photo_id}</div>
          </div>
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="text-amber-800">미등록 — 사진을 업로드하면 HeyGen에 자동 등록됩니다</div>
          </div>
        )}
        <div className="mt-3">
          <PhotoUpload hasPhoto={!!assets?.heygen_talking_photo_id} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          권장: 정면 얼굴 · 512×512 이상 · JPG/PNG · 단순한 배경 · 표정 자연스럽게
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">음성 (voice clone)</h2>
        {assets?.heygen_voice_id ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <div className="font-semibold text-emerald-800">✓ 등록 완료</div>
            <div className="mt-1 font-mono text-xs text-emerald-700">voice_id: {assets.heygen_voice_id}</div>
          </div>
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="text-amber-800">미등록 — 음성 샘플을 업로드하면 HeyGen Voice Clone에 등록됩니다 (v0.46)</div>
          </div>
        )}
        <div className="mt-3">
          <VoiceUpload hasVoice={!!assets?.heygen_voice_id} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          권장: 깨끗한 녹음 · 30초~3분 · 한국어 자연스러운 톤 · 배경 소음 최소
        </p>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        등록된 자산은 본인 작업에만 사용되며 KEG 외부에 공유되지 않습니다.
        삭제를 원하시면 본부장에게 요청해주세요.
      </p>
    </div>
  );
}
