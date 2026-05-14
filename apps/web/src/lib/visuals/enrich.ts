/**
 * 슬라이드에 시각 자료(이미지) 추가 — Gemini API 전용.
 *
 * 흐름:
 *   1. planSlideVisual (Gemini 2.0 Flash) — type 결정 + image_prompt 작성
 *   2. type === "none" → 스킵
 *   3. 그 외 → generatePromptedImage (Gemini Nano Banana / Imagen) → Storage 업로드
 *
 * 병렬 처리. 실패 시 visual_url 빈 문자열로 채워 영상 생성 자체는 진행.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { planSlideVisual } from "./planner";
import { generatePromptedImage } from "@/lib/external/gemini-image";

const VISUAL_BUCKET = "cast-slide-images"; // 슬라이드와 동일 버킷에 visual_* 접두

export type SlideWithVisual<T extends { title: string; slide_number: number; content_blocks?: string[] }> = T & {
  visual_url?: string;
  visual_alt?: string;
  visual_credit?: string;
  visual_type?: "photo" | "concept" | "none";
};

export async function enrichSlidesWithVisuals<
  T extends { title: string; slide_number: number; content_blocks?: string[] },
>(
  supabase: SupabaseClient,
  castJobId: string,
  topic: string,
  slides: T[],
): Promise<SlideWithVisual<T>[]> {
  const tasks = slides.map(async (slide): Promise<SlideWithVisual<T>> => {
    const plan = await planSlideVisual(topic, slide);
    if (plan.type === "none") return { ...slide, visual_type: "none" };

    try {
      // photo / concept 모두 Gemini Image 생성으로 처리
      const fallbackPrompt =
        plan.type === "photo"
          ? `Photorealistic photograph about: ${slide.title}. Natural lighting, professional, high detail, 16:9 widescreen, no text.`
          : `Minimalist educational illustration about: ${slide.title}. Clean modern design, suitable for slide presentation, 16:9 widescreen, no text or letters.`;
      const prompt = plan.image_prompt || fallbackPrompt;

      const generated = await generatePromptedImage(prompt);
      const ext = generated.mimeType === "image/png" ? "png" : "jpg";
      const path = `${castJobId}/visual-${String(slide.slide_number).padStart(3, "0")}.${ext}`;
      const buffer = Buffer.from(generated.base64, "base64");
      const { error } = await supabase.storage
        .from(VISUAL_BUCKET)
        .upload(path, buffer, { contentType: generated.mimeType, upsert: true });
      if (error) {
        console.warn(`[visual-enrich] slide ${slide.slide_number} upload failed: ${error.message}`);
        return { ...slide, visual_type: "none" };
      }
      const { data: pub } = supabase.storage.from(VISUAL_BUCKET).getPublicUrl(path);
      return {
        ...slide,
        visual_url: pub.publicUrl,
        visual_alt: slide.title,
        visual_credit: `AI generated · ${generated.model_used}`,
        visual_type: plan.type,
      };
    } catch (e) {
      console.warn(`[visual-enrich] slide ${slide.slide_number} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { ...slide, visual_type: "none" };
  });

  return Promise.all(tasks);
}
