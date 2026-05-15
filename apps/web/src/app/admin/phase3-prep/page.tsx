import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CHECKLIST = [
  {
    section: "확장성 검증",
    items: [
      { id: "load_500", label: "500 동시 사용자 부하 테스트 통과", hint: "k6 시나리오 100→500 VU 확장 후 p95 < 8s 목표" },
      { id: "supabase_pro", label: "Supabase Pro + connection pooling 활성화", hint: "100→500명은 pgBouncer 필수" },
      { id: "upstash_paid", label: "Upstash Pay-as-you-go 전환", hint: "free tier 10K req/day로는 부족" },
      { id: "cost_model", label: "500명 운영 시 월 비용 모델 검증", hint: "예상 $1000~$3000/월. 현 cost-guard 한도 상향 필요" },
    ],
  },
  {
    section: "콘텐츠 확장",
    items: [
      { id: "courses_4", label: "4개 일반 과정 선정", hint: "조리·이미용·바리스타·요양보호 우선 (KEG 강점 영역)" },
      { id: "sme_per_course", label: "과정당 SME 2명 영입", hint: "각 과정 평가·콘텐츠 보완 담당" },
      { id: "rag_per_course", label: "과정별 RAG 인덱싱 완료", hint: "각 과정 교재 → embeddings 1회성 작업, 비용 ~$5/과정" },
      { id: "samples", label: "과정별 샘플 콘텐츠 3건씩 (공개)", hint: "/samples 페이지에서 공개 전시" },
    ],
  },
  {
    section: "운영 인프라",
    items: [
      { id: "runbook_v1", label: "운영 매뉴얼 v1.0 작성", hint: "기존 docs/runbook/index.md 확장 — 500명 규모 SLA 반영" },
      { id: "instructor_training", label: "강사 교육 프로그램 설계", hint: "AI 콘텐츠 활용·신고·SME 협업 1시간 교육" },
      { id: "oncall_paid", label: "유료 On-call 도구 (PagerDuty 등)", hint: "주말 L3+ 인시던트 24/7 대응 위해 권장" },
      { id: "sentry_setup", label: "Sentry 셋업 (W7 미완)", hint: "오류 추적 — 500명 규모에서는 필수" },
      { id: "uptime_monitor", label: "UptimeRobot/BetterUptime — /api/health polling", hint: "다운타임 ≤5분 SLA 보장" },
    ],
  },
  {
    section: "재무·법무",
    items: [
      { id: "annual_budget", label: "차년도 예산 추정 + 승인", hint: "운영비 $1~3K/월 + AI 비용 $0.5~2K/월 + 인건비" },
      { id: "billing_model", label: "요금제 설계", hint: "무료 베타 → 유료 전환 ($/월 학생) 모델 합의" },
      { id: "pricing_test", label: "가격 민감도 사전 테스트", hint: "현 베타 졸업생 대상 willingness-to-pay 설문" },
      { id: "compliance_review", label: "법무팀 정식 출시 검토", hint: "PIPA·이용약관 v2 + 결제 약관 추가" },
    ],
  },
  {
    section: "마케팅·모집",
    items: [
      { id: "case_studies", label: "베타 success story 2~3건", hint: "G2 통과 학생 인터뷰 → 콘텐츠화" },
      { id: "instructor_pool", label: "강사 풀 확장", hint: "현 ?명 → Phase 3 시작 시 ?명 목표" },
      { id: "channels", label: "유료 모집 채널 확정", hint: "검색 광고·SNS·KEG 학원 연계" },
    ],
  },
];

export default async function Phase3PrepPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/phase3-prep");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const total = CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase 3 SCALE 준비</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            베타 → 500명·4개 과정 확장 체크리스트 ({total}개 항목)
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자 홈</Link>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm">
        <p>
          <strong>참고:</strong> 본 체크리스트는 시스템 진척 자동 추적이 아닌 본부장·TF 수기 검토용입니다.
          Notion·Linear에 동일 항목을 복사해 owner·due_date를 할당하세요.
        </p>
      </div>

      {CHECKLIST.map((section, si) => (
        <Card key={si}>
          <CardHeader className="px-6 pt-6">
            <h2 className="text-lg font-semibold">{si + 1}. {section.section} ({section.items.length}개)</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <input type="checkbox" id={item.id} className="mt-1" disabled />
                  <label htmlFor={item.id} className="flex-1">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.hint}</div>
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <div className="bg-muted/30 border rounded-lg p-5 text-sm">
        <h3 className="font-semibold mb-2">권장 다음 단계 (G2 GO 직후)</h3>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Phase 3 킥오프 미팅 (CEO·COO·본부장·TF, 90분)</li>
          <li>위 체크리스트를 Notion 보드로 복제 + owner 할당</li>
          <li>4개 일반 과정 선정 (2주 내)</li>
          <li>SME·강사 추가 영입 시작</li>
          <li>500명 부하 테스트 (k6 stress 시나리오 확장)</li>
        </ol>
      </div>
    </div>
  );
}
