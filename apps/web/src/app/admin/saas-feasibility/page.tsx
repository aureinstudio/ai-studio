import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">B2B SaaS 사업성 검토</h1>
        <p className="mt-1 text-sm text-muted-foreground">교육기관 대상 ai-studio 라이선스 모델 분석</p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">잠재 시장</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="국내 교육기관" value="≈4,500개" sub="평생교육원·학원·기업 교육" />
          <Stat label="자격증 학원" value="≈800개" sub="1차 타깃" />
          <Stat label="기업 교육팀" value="≈1,200개" sub="2차 타깃" />
          <Stat label="대학 평생교육" value="≈400개" sub="3차 타깃" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          출처: 한국교육개발원·통계청 (2025 추정). 보수적 진입률 1%면 45개 기관.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">가격 모델</h2>
        <div className="space-y-3 text-sm">
          <PricingRow tier="Starter" price="월 ₩500K" feature="100 학생 이내 / Studio·Tutor만 / 이메일 지원" target="소규모 학원" />
          <PricingRow tier="Pro" price="월 ₩2M" feature="500 학생 / 전체 솔루션 / 우선 지원" target="중규모 평생교육원" />
          <PricingRow tier="Enterprise" price="연 ₩30M+" feature="무제한 / White-label / SLA / 전담 매니저" target="대학·기업" />
          <PricingRow tier="Per-Student" price="₩10K/학생/월" feature="사용량 기반 (스타트업 친화)" target="신규 교육 스타트업" />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">경쟁 분석</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">경쟁사</th>
                <th className="px-3 py-2 text-left">강점</th>
                <th className="px-3 py-2 text-left">약점</th>
                <th className="px-3 py-2 text-left">ai-studio 차별점</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">매직에꼴</td>
                <td className="px-3 py-2 text-xs">국내 인지도, 자격증 특화</td>
                <td className="px-3 py-2 text-xs">단순 콘텐츠 생성, AI 튜터 약함</td>
                <td className="px-3 py-2 text-xs">3-솔루션 통합 (생성+영상+튜터), 다중 카테고리 어댑터</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">Coursera / Udemy</td>
                <td className="px-3 py-2 text-xs">글로벌, 콘텐츠 풍부</td>
                <td className="px-3 py-2 text-xs">국내 시장 미진입, AI 생성 미지원</td>
                <td className="px-3 py-2 text-xs">한국어 네이티브, 자격증 합격 보장 모델</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">OpenAI Tutor 류</td>
                <td className="px-3 py-2 text-xs">최신 AI, 범용</td>
                <td className="px-3 py-2 text-xs">교육 도메인 깊이 부족, 환각 차단 약함</td>
                <td className="px-3 py-2 text-xs">RAG 기반 환각 차단, 강사·SME 검증 루프</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">차별화 포인트</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li><b>3-솔루션 통합:</b> Studio (콘텐츠) + Cast (영상) + Tutor (1:1 AI) — 경쟁사 대비 유일</li>
          <li><b>다중 카테고리 어댑터:</b> 자격증·직무·언어·취미·학술 — 한 플랫폼에서 5종</li>
          <li><b>실증 데이터:</b> 14주 베타 KPI · 학생 NPS · 환각 차단율 — 마케팅 자료화 가능</li>
          <li><b>강사 격상 모델:</b> 강사 = 검수·코치 역할 → 교육기관 인력 안정성 ↑</li>
          <li><b>RAG + SME 검증:</b> 환각 차단 + 정확도 보장 (경쟁사 대비 차별)</li>
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">진입 전략</h2>
        <ol className="list-decimal space-y-2 pl-6 text-sm">
          <li><b>Phase A (0~3개월):</b> 친밀 채널 5개 기관 무료 PoC → 케이스 스터디 확보</li>
          <li><b>Phase B (3~6개월):</b> Starter 플랜 출시 + 자격증 학원 집중 영업 (월 5건 목표)</li>
          <li><b>Phase C (6~12개월):</b> Pro 플랜 + 백채널 (KEG 본사 네트워크) 활용 → 월 8건</li>
          <li><b>Phase D (12개월+):</b> Enterprise 영업 + 대학 파트너십</li>
        </ol>
      </section>

      <section className="rounded-lg border bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-amber-900">초기 추정 (Year 1)</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-amber-800">예상 고객</div>
            <div className="text-2xl font-bold">8~12 기관</div>
          </div>
          <div>
            <div className="text-xs text-amber-800">예상 매출</div>
            <div className="text-2xl font-bold">₩3~5억</div>
          </div>
          <div>
            <div className="text-xs text-amber-800">손익분기</div>
            <div className="text-2xl font-bold">14~18개월</div>
          </div>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        이 분석은 W14 종합 평가 자료입니다. 정식 사업계획은 G3 결정 후 phase4_plans에서 확정됩니다.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function PricingRow({ tier, price, feature, target }: { tier: string; price: string; feature: string; target: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <div className="w-24 font-semibold">{tier}</div>
      <div className="w-32 font-mono text-sm">{price}</div>
      <div className="flex-1 text-xs text-muted-foreground">{feature}</div>
      <div className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{target}</div>
    </div>
  );
}
