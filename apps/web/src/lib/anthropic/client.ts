import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic Claude 클라이언트 — 서버 측 전용.
 *
 * ⚠️ 절대 클라이언트 컴포넌트에 import 금지 — API 키 노출 위험.
 * 키는 ANTHROPIC_API_KEY (NEXT_PUBLIC_ 접두사 *없음*) — 서버에서만 접근.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  // Sonnet 한국어 대량 생성(8K-15K tokens) = 100-150s 가능.
  // VisualPlanner는 큐레이터 입력 받아 추가 출력 → 가장 느림.
  // 180s 여유 + 재시도 0 (재시도해도 같은 이유로 실패).
  timeout: 180_000,
  maxRetries: 0,
});

/**
 * 기본 모델 — Claude Sonnet 4.5.
 * 가격: $3/M input, $15/M output (2026-05 기준).
 *
 * 향후 업그레이드 후보: claude-sonnet-4-6 (동일 가격) · claude-opus-4-7 (5x 비싸지만 더 똑똑)
 */
export const MODEL = "claude-sonnet-4-5";

/**
 * 기본 max_tokens — Sonnet 4.5 모델 한계(64K)에 맞춰 *실질적으로 무제한*.
 * Claude는 자체적으로 콘텐츠 길이 판단해서 끝맺음 — 이 값은 *cap*일 뿐 평균 사용량은 훨씬 적음.
 * 최악 경우: 64000 × $15/M = $0.96 (1회 호출 상한). 100회 < $100 — PoC 가드 충분.
 * 실제로 큐레이터 1회 ≈ 5-7K tokens out, 평균 비용 ≈ $0.08-$0.11.
 */
export const MAX_TOKENS = 64000;

/**
 * 기본 temperature — 0.7.
 * 너무 낮으면 (0.0~0.3) 단조로운 콘텐츠, 너무 높으면 (0.9+) 환각 위험 ↑.
 * 0.7 = 교재 PD가 다양한 예시·표현 시도하기 적합.
 */
export const DEFAULT_TEMPERATURE = 0.7;
