import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Claude 모델별 가격 (USD per 1M tokens, 2026-05 기준).
 * 가격 변경 시 본 표만 갱신 — 호출처 전체 자동 반영.
 */
const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  // Haiku는 KEG 콘텐츠 품질 정책상 사용 금지 — 가격표에서 의도적으로 제외
};

/**
 * Claude 호출 비용 계산.
 * 알려지지 않은 모델은 0 반환 (무시 + 로그 권장 — 미래 모델 가드).
 */
export function calculateClaudeCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  // 모델 ID에서 버전 suffix(-20251001 등) 제거
  const baseModel = model.replace(/-\d{8}$/, "");
  const pricing = PRICING_PER_MILLION[baseModel];
  if (!pricing) {
    console.warn(`[cost-tracker] Unknown model pricing: ${model}`);
    return 0;
  }
  const inputCost = (tokensIn / 1_000_000) * pricing.input;
  const outputCost = (tokensOut / 1_000_000) * pricing.output;
  // 6자리까지 반올림 — DB numeric(10, 6) 정밀도 정합
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/**
 * cost_log 테이블에 1행 INSERT.
 *
 * RLS: 본 호출은 *사용자 세션* 컨텍스트의 supabase 클라이언트로 들어와야 함.
 * (API 라우트에서 createClient(server.ts) 사용 — auth.uid() = user.id 일치)
 *
 * Insert 실패도 *사용자 응답엔 영향 없음* — 비용 로깅 실패가 메인 흐름 차단 X.
 */
export async function logCost(params: {
  supabase: SupabaseClient;
  service: string;
  endpoint: string;
  userId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { supabase, service, endpoint, userId, tokensIn, tokensOut, costUsd, metadata } = params;

  const { error } = await supabase.from("cost_log").insert({
    service,
    endpoint,
    user_id: userId,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("[cost-tracker] Failed to log cost:", error);
    // 의도적 무시 — 메인 응답에 영향 X
  }
}
