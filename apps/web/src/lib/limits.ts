/**
 * 비용·사용량 한도 — 단일 진실 소스.
 * 환경변수로 override 가능 (예: production에서 본부장이 ENV로 조정).
 */
export const DAILY_USD_LIMIT = Number(
  process.env.NEXT_PUBLIC_DAILY_USD_LIMIT ?? 50,
);

/**
 * Cast (TTS · Avatar) 일일 한도 — LLM보다 10배 비싸므로 별도 가드.
 * 영상 생성 1회 = $1~3, 무방비 사용 시 빠르게 누적.
 */
export const CAST_DAILY_LIMIT_USD = Number(
  process.env.CAST_DAILY_LIMIT_USD ?? 30,
);

/**
 * 한도 도달 % 기반 색상 결정.
 * - <80%: 녹색 (정상)
 * - 80~99%: 노랑 (주의)
 * - ≥100%: 빨강 (차단)
 */
export function budgetSeverity(usedUsd: number, limitUsd = DAILY_USD_LIMIT): "ok" | "warn" | "block" {
  const pct = usedUsd / limitUsd;
  if (pct >= 1) return "block";
  if (pct >= 0.8) return "warn";
  return "ok";
}
