/**
 * Unsplash 검색 — 슬라이드용 실사진.
 * 무료 50 req/h (Demo) · 5000 req/h (Production 승인 후).
 *
 * 환경변수: UNSPLASH_ACCESS_KEY
 *   가입: https://unsplash.com/developers
 */

export type UnsplashResult = {
  url: string;
  alt: string | null;
  photographer: string;
  photographer_url: string;
};

export async function searchUnsplash(query: string): Promise<UnsplashResult | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: Array<{
        urls?: { regular?: string; full?: string };
        alt_description?: string | null;
        user?: { name?: string; links?: { html?: string } };
      }>;
    };
    const hit = json.results?.[0];
    if (!hit?.urls?.regular) return null;
    return {
      url: hit.urls.regular,
      alt: hit.alt_description ?? null,
      photographer: hit.user?.name ?? "Unsplash contributor",
      photographer_url: hit.user?.links?.html ?? "https://unsplash.com",
    };
  } catch {
    return null;
  }
}
