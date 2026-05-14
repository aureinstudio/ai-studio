/**
 * 슬라이드에 시각 자료(이미지) 추가.
 *
 * 흐름:
 *   1. planSlideVisual (Gemini) — type/search_term/image_prompt 결정
 *   2. type === "photo" → Unsplash 검색
 *   3. type === "concept" → Gemini Image 생성 → Storage 업로드
 *   4. type === "none" → 스킵
 *
 * 병렬 처리. 실패 시 visual_url 빈 문자열로 채워 영상 생성 자체는 진행.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { planSlideVisual } from "./planner";
import { searchUnsplash } from "./unsplash";
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
      if (plan.type === "photo" && plan.search_term) {
        const hit = await searchUnsplash(plan.search_term);
        if (hit) {
          return {
            ...slide,
            visual_url: hit.url,
            visual_alt: hit.alt ?? plan.search_term,
            visual_credit: `Photo: ${hit.photographer} / Unsplash`,
            visual_type: "photo",
          };
        }
        // Unsplash miss → concept으로 fallback
      }

      if (plan.type === "concept" || plan.type === "photo") {
        const promptFinal =
          plan.image_prompt ||
          `Minimalist educational illustration about: ${slide.title}. Clean, modern, suitable for slide presentation. 16:9 aspect ratio.`;
        const generated = await generatePromptedImage(promptFinal);
        const path = `${castJobId}/visual-${String(slide.slide_number).padStart(3, "0")}.${generated.mimeType === "image/png" ? "png" : "jpg"}`;
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
          visual_type: "concept",
        };
      }
    } catch (e) {
      console.warn(`[visual-enrich] slide ${slide.slide_number} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { ...slide, visual_type: "none" };
  });

  return Promise.all(tasks);
}
