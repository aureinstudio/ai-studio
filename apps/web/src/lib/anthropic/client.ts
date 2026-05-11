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
  timeout: 180_000,
  // SDK 자동 재시도 — 429 (rate limit) 시 Retry-After 헤더 기반 백오프.
  // 5xx 서버 오류·네트워크 일시 장애도 자동 복구.
  // 408/timeout은 같은 이유로 또 실패할 가능성 높지만 일시적 hiccup도 있어 3회 시도.
  maxRetries: 3,
});

/**
 * 허용 모델 — 사용자(본부장) 토글로 선택. 자동 다운그레이드 금지.
 * 정책 (2026-05-10 갱신): Sonnet 기본 · Opus 고품질 · Haiku 속도/비용
 */
export const ALLOWED_MODELS = [
  "claude-sonnet-4-5",
  "claude-opus-4-7",
  "claude-haiku-4-5",
] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export const MODEL_LABELS: Record<AllowedModel, string> = {
  "claude-sonnet-4-5": "Sonnet 4.5",
  "claude-opus-4-7": "Opus 4.7",
  "claude-haiku-4-5": "Haiku 4.5",
};

/**
 * 기본 모델 — Claude Sonnet 4.5.
 * 가격: $3/M input, $15/M output (2026-05 기준).
 */
export const MODEL: AllowedModel = "claude-sonnet-4-5";

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
