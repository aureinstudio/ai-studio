/**
 * Cast — 슬라이드 이미지 렌더링.
 *
 * Studio가 생성한 슬라이드 텍스트(title + content_blocks)를 1920×1080 PNG로 변환.
 * HeyGen scene의 background로 사용 → 영상 = 슬라이드 + 아바타 PIP.
 *
 * 렌더링: next/og (Satori + Resvg). 한글은 Pretendard 폰트 CDN 동적 로드.
 */
import { ImageResponse } from "next/og";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlideInputMeta } from "./slide-analyzer";

const BUCKET = "cast-slide-images";
const PRETENDARD_SEMIBOLD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-SemiBold.otf";
const PRETENDARD_REGULAR =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf";

let fontCache: Promise<{ semibold: ArrayBuffer; regular: ArrayBuffer }> | null = null;
function loadFonts() {
  if (!fontCache) {
    fontCache = (async () => {
      const [a, b] = await Promise.all([
        fetch(PRETENDARD_SEMIBOLD).then((r) => r.arrayBuffer()),
        fetch(PRETENDARD_REGULAR).then((r) => r.arrayBuffer()),
      ]);
      return { semibold: a, regular: b };
    })().catch((err) => {
      fontCache = null;
      throw err;
    });
  }
  return fontCache;
}

export type SlideImageResult = {
  slide_number: number;
  url: string;
  path: string;
};

/**
 * 슬라이드 JSX — 1920×1080. 좌측 컨텐츠 영역, 우하단 480×480 영역은 아바타용 공백.
 */
function SlideJsx(props: { topic: string; slide: SlideInputMeta }) {
  const { topic, slide } = props;
  // PIP 영역(우하단 ~480px) 침범 회피 — 컨텐츠 폭 1280px로 제한
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "80px 96px 96px 96px",
        fontFamily: "Pretendard",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 22,
          color: "#94a3b8",
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 32,
        }}
      >
        KEG · {topic}
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.15,
          marginBottom: 48,
          maxWidth: 1280,
        }}
      >
        {slide.title}
      </div>
      <div
        style={{
          width: 120,
          height: 6,
          background: "#22d3ee",
          marginBottom: 56,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          maxWidth: 1280,
        }}
      >
        {(slide.content_blocks ?? []).slice(0, 5).map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              fontSize: 36,
              lineHeight: 1.4,
              color: "#e2e8f0",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#22d3ee",
                marginTop: 18,
                marginRight: 24,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>{b}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 20,
          color: "#64748b",
        }}
      >
        <div>슬라이드 {slide.slide_number}</div>
        <div>KEG AI Studio</div>
      </div>
    </div>
  );
}

async function renderSlideToPng(topic: string, slide: SlideInputMeta): Promise<Buffer> {
  const { semibold, regular } = await loadFonts();
  const img = new ImageResponse(<SlideJsx topic={topic} slide={slide} />, {
    width: 1920,
    height: 1080,
    fonts: [
      { name: "Pretendard", data: regular, weight: 400, style: "normal" },
      { name: "Pretendard", data: semibold, weight: 700, style: "normal" },
    ],
  });
  const buf = await img.arrayBuffer();
  return Buffer.from(buf);
}

/**
 * 슬라이드 1장 렌더 + Storage 업로드.
 */
export async function generateSlideImage(
  supabase: SupabaseClient,
  castJobId: string,
  topic: string,
  slide: SlideInputMeta,
): Promise<SlideImageResult> {
  const png = await renderSlideToPng(topic, slide);
  const path = `${castJobId}/slide-${String(slide.slide_number).padStart(3, "0")}.png`;

  // 버킷 생성 시도 (idempotent). 운영 환경은 0025 마이그레이션으로 사전 생성됨.
  // "already exists"만 무시하고 그 외 실패는 로그 — 무조건 catch로 삼키지 않음.
  const createRes = await supabase.storage
    .createBucket(BUCKET, { public: true })
    .then(() => ({ ok: true as const, err: undefined }))
    .catch((e: unknown) => ({ ok: false as const, err: e instanceof Error ? e.message : String(e) }));
  if (!createRes.ok && createRes.err && !/already exists|duplicate/i.test(createRes.err)) {
    console.warn(`[slide-image] bucket create failed (continuing to upload): ${createRes.err}`);
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (upErr) {
    console.error(`[slide-image] upload failed slide ${slide.slide_number} → ${BUCKET}/${path}: ${upErr.message}`);
    throw new Error(`slide image upload failed: ${upErr.message}`);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { slide_number: slide.slide_number, url: pub.publicUrl, path };
}

/**
 * 전체 슬라이드 병렬 렌더. 실패한 장은 url=""로 반환 (HeyGen이 단색 fallback).
 */
export type SlideImageBatchResult = {
  images: SlideImageResult[];
  first_error: string | null;
};

export async function generateAllSlideImages(
  supabase: SupabaseClient,
  castJobId: string,
  topic: string,
  slides: SlideInputMeta[],
): Promise<SlideImageResult[]> {
  const r = await generateAllSlideImagesDetailed(supabase, castJobId, topic, slides);
  return r.images;
}

/**
 * 상세 버전 — 첫 번째 실패 에러 메시지 함께 반환 (orchestrator가 agent_logs.error에 노출).
 */
export async function generateAllSlideImagesDetailed(
  supabase: SupabaseClient,
  castJobId: string,
  topic: string,
  slides: SlideInputMeta[],
): Promise<SlideImageBatchResult> {
  let firstError: string | null = null;
  const tasks = slides.map((s) =>
    generateSlideImage(supabase, castJobId, topic, s).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cast/slide-image] slide ${s.slide_number} failed: ${msg}`);
      if (!firstError) firstError = msg;
      return { slide_number: s.slide_number, url: "", path: "" } as SlideImageResult;
    }),
  );
  const images = await Promise.all(tasks);
  return { images, first_error: firstError };
}
