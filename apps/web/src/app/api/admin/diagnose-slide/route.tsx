import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/admin/diagnose-slide
 *
 * 단일 슬라이드 렌더 + Storage 업로드 정확한 실패 지점 노출.
 * Vercel function logs 대용 — 본부장이 브라우저에서 직접 호출 가능.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const diagnostics: Record<string, unknown> = {};

  // 1. 폰트 fetch 테스트
  const PRETENDARD_SEMIBOLD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-SemiBold.otf";
  const t1 = performance.now();
  try {
    const res = await fetch(PRETENDARD_SEMIBOLD);
    const buf = await res.arrayBuffer();
    diagnostics.font_fetch = {
      ok: res.ok,
      status: res.status,
      bytes: buf.byteLength,
      duration_ms: Math.round(performance.now() - t1),
    };
  } catch (e) {
    diagnostics.font_fetch = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2. next/og 임포트 + 렌더 시도
  const t2 = performance.now();
  try {
    const { ImageResponse } = await import("next/og");
    const img = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#fff",
            fontSize: 48,
          }}
        >
          Test 슬라이드
        </div>
      ),
      { width: 1920, height: 1080 },
    );
    const buf = await img.arrayBuffer();
    diagnostics.render_no_font = {
      ok: true,
      bytes: buf.byteLength,
      duration_ms: Math.round(performance.now() - t2),
    };
  } catch (e) {
    diagnostics.render_no_font = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.slice(0, 500) : undefined,
    };
  }

  // 3. 폰트 포함 렌더 시도
  const t3 = performance.now();
  try {
    const fontRes = await fetch(PRETENDARD_SEMIBOLD);
    const fontBuf = await fontRes.arrayBuffer();
    const { ImageResponse } = await import("next/og");
    const img = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#fff",
            fontSize: 60,
            fontFamily: "Pretendard",
          }}
        >
          한글 폰트 테스트
        </div>
      ),
      {
        width: 1920,
        height: 1080,
        fonts: [{ name: "Pretendard", data: fontBuf, weight: 700, style: "normal" }],
      },
    );
    const buf = await img.arrayBuffer();
    diagnostics.render_with_font = {
      ok: true,
      bytes: buf.byteLength,
      duration_ms: Math.round(performance.now() - t3),
    };
  } catch (e) {
    diagnostics.render_with_font = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.slice(0, 500) : undefined,
    };
  }

  return NextResponse.json(diagnostics, { headers: { "Cache-Control": "no-store" } });
}
