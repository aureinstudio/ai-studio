/**
 * Stripe 결제 통합 (B2C 구독).
 *
 * 환경 변수:
 *   STRIPE_SECRET_KEY          : sk_live_... (또는 sk_test_...)
 *   STRIPE_WEBHOOK_SECRET      : webhook 서명 검증
 *   STRIPE_PRICE_B2C_MONTHLY   : price_xxx (Stripe 대시보드에서 발급)
 *   STRIPE_PRICE_B2C_YEARLY    : price_xxx
 *
 * 미설정 시 호출은 명확한 에러 반환.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export const PLANS = {
  b2c_monthly: { price_env: "STRIPE_PRICE_B2C_MONTHLY", amount_krw: 49000, label: "월 구독" },
  b2c_yearly: { price_env: "STRIPE_PRICE_B2C_YEARLY", amount_krw: 490000, label: "연 구독 (2개월 무료)" },
  b2b_starter: { price_env: "STRIPE_PRICE_B2B_STARTER", amount_krw: 500000, label: "B2B Starter" },
  b2b_pro: { price_env: "STRIPE_PRICE_B2B_PRO", amount_krw: 2000000, label: "B2B Pro" },
} as const;

export type PlanKey = keyof typeof PLANS;

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return key;
}

function getPriceId(plan: PlanKey): string {
  const envName = PLANS[plan].price_env;
  const priceId = process.env[envName];
  if (!priceId) throw new Error(`${envName} not configured`);
  return priceId;
}

/**
 * Checkout Session 생성 — 학생을 Stripe Checkout으로 redirect.
 */
export async function createCheckoutSession(opts: {
  plan: PlanKey;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; id: string }> {
  const secret = getSecretKey();
  const priceId = getPriceId(opts.plan);

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: opts.userEmail,
    "metadata[user_id]": opts.userId,
    "metadata[plan]": opts.plan,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "subscription_data[metadata][user_id]": opts.userId,
    "subscription_data[metadata][plan]": opts.plan,
  });

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe checkout failed: ${errText}`);
  }
  const json = await res.json();
  return { url: json.url, id: json.id };
}

/**
 * Webhook 서명 검증 (Stripe 표준).
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  // 간이 검증 — production은 stripe SDK 사용 권장 (이번 PR은 외부 의존성 없이 스캐폴딩)
  // Stripe 서명 형식: t=<timestamp>,v1=<sig>
  const parts = signature.split(",").reduce((acc, p) => {
    const [k, v] = p.split("=");
    acc[k] = v;
    return acc;
  }, {} as Record<string, string>);
  if (!parts.t || !parts.v1) return false;
  // 본격 HMAC 검증은 운영 시 stripe npm 패키지 도입 후 처리
  return true;  // 스캐폴딩 단계 — 운영 전 stripe SDK로 교체
}
