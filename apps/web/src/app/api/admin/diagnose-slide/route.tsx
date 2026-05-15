import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlideImage } from "@/lib/agents/cast/slide-image";
import type { SlideInputMeta } from "@/lib/agents/cast/slide-analyzer";

export const runtime = "nodejs";

const TEST_SLIDE: SlideInputMeta = {
  slide_number: 999,
  title: "테스트 슬라이드 — Diagnose",
  content_blocks: [
    "첫 번째 블릿 항목입니다",
    "두 번째 블릿 — 한글 + English mix",
    "세 번째: 숫자 123 + 기호 (%, &, *)",
  ],
  visual_suggestions: "",
  speaker_notes: "",
};

/**
 * GET /api/admin/diagnose-slide
 *
 * 실제 generateSlideImage 함수를 가짜 슬라이드 1장으로 직접 호출 →
 * 정확한 실패 지점·메시지 노출.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const out: Record<string, unknown> = {};
  const admin = createAdminClient();
  const fakeJobId = `diagnose-${Date.now()}`;

  const t = performance.now();
  try {
    const result = await generateSlideImage(admin, fakeJobId, "diagnose 테스트", TEST_SLIDE);
    out.real_generateSlideImage = {
      ok: true,
      duration_ms: Math.round(performance.now() - t),
      url: result.url,
      path: result.path,
    };

    if (result.url) {
      const headRes = await fetch(result.url, { method: "HEAD" }).catch(() => null);
      out.uploaded_file_check = {
        status: headRes?.status ?? "fetch failed",
        content_type: headRes?.headers.get("content-type") ?? "?",
        content_length: headRes?.headers.get("content-length") ?? "?",
      };
    }

    await admin.storage.from("cast-slide-images").remove([result.path]).catch(() => {});
  } catch (e) {
    out.real_generateSlideImage = {
      ok: false,
      duration_ms: Math.round(performance.now() - t),
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.slice(0, 800) : undefined,
    };
  }

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
