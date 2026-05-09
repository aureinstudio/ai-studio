import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic Claude 클라이언트 — 서버 측 전용.
 *
 * ⚠️ 절대 클라이언트 컴포넌트에 import 금지 — API 키 노출 위험.
 * 키는 ANTHROPIC_API_KEY (NEXT_PUBLIC_ 접두사 *없음*) — 서버에서만 접근.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 60_000, // 60s — 긴 생성 응답 대비
  maxRetries: 1, // SDK 자동 재시도 1회 (408/429/500/502/503/504)
});

/**
 * 기본 모델 — Claude Sonnet 4.5.
 * 가격: $3/M input, $15/M output (2026-05 기준).
 *
 * 향후 업그레이드 후보: claude-sonnet-4-6 (동일 가격) · claude-opus-4-7 (5x 비싸지만 더 똑똑)
 */
export const MODEL = "claude-sonnet-4-5";

/**
 * 기본 max_tokens — 비용 가드레일.
 * 최악 경우: 4096 × $15/M = $0.0614 (1회 호출 비용 상한).
 * 100회 누적 시 < $7 — PoC 안전 범위.
 */
export const MAX_TOKENS = 4096;

/**
 * 기본 temperature — 0.7.
 * 너무 낮으면 (0.0~0.3) 단조로운 콘텐츠, 너무 높으면 (0.9+) 환각 위험 ↑.
 * 0.7 = 교재 PD가 다양한 예시·표현 시도하기 적합.
 */
export const DEFAULT_TEMPERATURE = 0.7;
