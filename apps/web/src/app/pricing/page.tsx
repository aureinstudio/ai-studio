import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SubscribeButton from "./subscribe-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing · ai-studio" };

const PLANS = [
  {
    key: "b2c_monthly",
    label: "월 구독",
    price: "₩49,000",
    period: "월",
    features: ["5개 과정 무제한 학습", "AI 튜터 24/7", "Studio·Cast 생성 무제한", "수료증 발급"],
    highlight: false,
  },
  {
    key: "b2c_yearly",
    label: "연 구독",
    price: "₩490,000",
    period: "년",
    features: ["월 구독 모든 기능", "2개월 무료 (총 17% 할인)", "우선 지원", "베타 신기능 우선 접근"],
    highlight: true,
  },
] as const;

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold">요금제</h1>
        <p className="mt-3 text-lg text-muted-foreground">5개 과정 무제한 학습 + AI 튜터 24/7</p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {PLANS.map((p) => (
          <div key={p.key} className={`rounded-lg border-2 p-8 ${p.highlight ? "border-amber-400 bg-amber-50" : "border-zinc-200"}`}>
            {p.highlight && <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">⭐ 추천</div>}
            <h2 className="text-2xl font-bold">{p.label}</h2>
            <div className="mt-4">
              <span className="text-4xl font-bold">{p.price}</span>
              <span className="text-muted-foreground"> / {p.period}</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {user ? (
                <SubscribeButton plan={p.key} label={`${p.label} 시작`} highlight={p.highlight} />
              ) : (
                <Link href={`/login?next=/pricing`} className="block w-full rounded-md border bg-foreground py-3 text-center text-sm font-medium text-background">
                  로그인 후 시작
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-12 rounded-lg border bg-muted/30 p-6 text-sm">
        <h3 className="mb-2 font-bold">B2B 가격</h3>
        <p>교육기관·기업용 라이선스는 별도 문의: <a href="mailto:aureinstudio@gmail.com" className="text-blue-600 hover:underline">aureinstudio@gmail.com</a></p>
        <p className="mt-1 text-xs text-muted-foreground">Starter ₩500K/월, Pro ₩2M/월, Enterprise 협의</p>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        결제는 Stripe로 처리됩니다. 부가세 별도. 언제든 취소 가능.
      </p>
    </div>
  );
}
