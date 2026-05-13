import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DecisionForm from "./decision-form";

export const dynamic = "force-dynamic";

const OPTIONS = [
  {
    key: "expand",
    label: "EXPAND — 확장",
    summary: "과정 10개+ · 학생 1,000명+",
    pros: ["빠른 매출 성장", "브랜드 확대", "AI 학습 데이터 축적"],
    cons: ["추가 인력 5~8명 필요", "운영 복잡도 ↑", "초기 손실 가능성"],
    investment_krw: 800_000_000,
    revenue_12m: 1_500_000_000,
    revenue_24m: 4_000_000_000,
    headcount: 8,
    risk: "급격한 확장으로 품질 저하 우려, 운영 리소스 부족",
  },
  {
    key: "deepen",
    label: "DEEPEN — 심화",
    summary: "5개 과정 · 학생 500명 안정 운영",
    pros: ["품질 안정성 ↑", "수익성 명확", "리스크 낮음"],
    cons: ["성장 정체 가능", "경쟁사 추격 여지"],
    investment_krw: 200_000_000,
    revenue_12m: 700_000_000,
    revenue_24m: 1_600_000_000,
    headcount: 2,
    risk: "기회비용 — 빠르게 시장 점유 못 함",
  },
  {
    key: "saas",
    label: "SAAS — B2B 사업화",
    summary: "외부 교육기관 라이선스",
    pros: ["고마진 반복 매출", "확장성 ↑↑", "Aurein 협력 시 시너지"],
    cons: ["영업·CS 인력 필요", "초기 진입 장벽"],
    investment_krw: 500_000_000,
    revenue_12m: 400_000_000,
    revenue_24m: 2_500_000_000,
    headcount: 5,
    risk: "B2B 영업 사이클 6~12개월, 초기 매출 지연",
  },
  {
    key: "stop",
    label: "STOP — 중단",
    summary: "베타 종료 후 본 업무 복귀",
    pros: ["손실 최소화", "리소스 회수"],
    cons: ["14주 투자 손실", "AI 역량 사장", "본부장 사기 영향"],
    investment_krw: 0,
    revenue_12m: 0,
    revenue_24m: 0,
    headcount: 0,
    risk: "기회 손실 — 검증된 PoC를 폐기",
  },
] as const;

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("g3_decisions")
    .select("selected_option, rationale, next_quarter_actions, decided_at")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Gate G3 의사결정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          14주 ai-studio 베타 사업의 차년도 방향 결정. CEO·이사회가 4 옵션 중 1을 선택하고 사유를 기록합니다.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((opt) => (
          <div key={opt.key} className={`rounded-lg border bg-card p-5 ${existing?.selected_option === opt.key ? "border-foreground ring-2 ring-foreground/20" : ""}`}>
            <h2 className="text-lg font-bold">{opt.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{opt.summary}</p>

            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">투자</dt><dd className="font-mono">₩{(opt.investment_krw / 1_0000_0000).toFixed(0)}억</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">12M 매출</dt><dd className="font-mono">₩{(opt.revenue_12m / 1_0000_0000).toFixed(1)}억</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">24M 매출</dt><dd className="font-mono">₩{(opt.revenue_24m / 1_0000_0000).toFixed(1)}억</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">인력</dt><dd className="font-mono">+{opt.headcount}명</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ROI 24M</dt>
                <dd className="font-mono">
                  {opt.investment_krw > 0
                    ? `${Math.round(((opt.revenue_24m - opt.investment_krw) / opt.investment_krw) * 100)}%`
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-2 text-xs">
              <div>
                <div className="font-semibold text-emerald-700">장점</div>
                <ul className="ml-4 list-disc">{opt.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
              <div>
                <div className="font-semibold text-red-700">단점</div>
                <ul className="ml-4 list-disc">{opt.cons.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
              <div>
                <div className="font-semibold text-amber-700">주요 리스크</div>
                <p className="ml-1 text-muted-foreground">{opt.risk}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">의사결정 기록</h2>
        {existing && (
          <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm">
            <div className="font-semibold text-emerald-800">
              현재 결정: {OPTIONS.find((o) => o.key === existing.selected_option)?.label}
            </div>
            <div className="mt-1 text-xs text-emerald-700">
              결정일: {new Date(existing.decided_at).toLocaleString("ko-KR")}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{existing.rationale}</p>
            {existing.next_quarter_actions && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold">다음 분기 액션 플랜</summary>
                <pre className="mt-1 whitespace-pre-wrap text-xs">{existing.next_quarter_actions}</pre>
              </details>
            )}
          </div>
        )}
        <DecisionForm
          options={OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          initialKey={existing?.selected_option ?? null}
        />
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        결정 저장 시 phase4_plans에 차년도 사업 계획 초안이 자동 생성됩니다 (Studio 활용).
        STOP 결정 시 학생 데이터 처리 안내 메일이 자동 발송됩니다.
      </p>
    </div>
  );
}
