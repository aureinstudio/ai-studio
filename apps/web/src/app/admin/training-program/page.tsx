import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Module = {
  role: string;
  emoji: string;
  hours: number;
  audience: string;
  goals: string[];
  resources: { label: string; href: string }[];
};

const MODULES: Module[] = [
  {
    role: "임원 (CEO·이사회)",
    emoji: "🎯",
    hours: 1,
    audience: "의사결정자 — KPI 해석·예산 결재·전략 방향",
    goals: [
      "Gate G2 5 가설 + NPS·SME 합격선 의미 이해",
      "월 예산 vs 누적 비용 추이 해석",
      "GO/HOLD/NO-GO 의사결정 프레임 숙지",
    ],
    resources: [
      { label: "/admin/executive (CEO 대시보드)", href: "/admin/executive" },
      { label: "/admin/g2-readiness (G2 종합)", href: "/admin/g2-readiness" },
      { label: "/admin/g2-final-report (인쇄용)", href: "/admin/g2-final-report" },
    ],
  },
  {
    role: "본부장",
    emoji: "👔",
    hours: 2,
    audience: "프로젝트 리드 — 일상 모니터링·위임·인시던트 대응",
    goals: [
      "일일 리포트 메일 5분 안에 해석",
      "/admin/founder-dependency로 위임 비율 추적",
      "L3+ 인시던트 1차 대응 + 본부장 직접 처리 범위 결정",
    ],
    resources: [
      { label: "runbook — 일상 운영", href: "/admin/runbook?doc=daily-ops" },
      { label: "runbook — 위임 체크리스트", href: "/admin/runbook?doc=delegation-checklist" },
      { label: "/admin/founder-dependency", href: "/admin/founder-dependency" },
    ],
  },
  {
    role: "운영팀",
    emoji: "🛠️",
    hours: 4,
    audience: "일상 운영 실무 — CS·신청 검토·위험 대응",
    goals: [
      "/operations/dashboard 1차 액션 큐 4종 처리",
      "베타 신청 24시간 내 검토·승인",
      "위험 학생 격려·강사 라우팅 액션",
      "비용 임계 80% 알림 1차 분류",
    ],
    resources: [
      { label: "/operations/dashboard", href: "/operations/dashboard" },
      { label: "runbook — 학생 관리", href: "/admin/runbook?doc=student-management" },
      { label: "runbook — 비용 관리", href: "/admin/runbook?doc=cost-management" },
      { label: "runbook — 인시던트 대응", href: "/admin/runbook?doc=incident-response" },
    ],
  },
  {
    role: "강사",
    emoji: "👨‍🏫",
    hours: 8,
    audience: "콘텐츠 활용 + 학생 케어",
    goals: [
      "Studio로 콘텐츠 초안 생성 (5 카테고리 어댑터 선택)",
      "/instructor/dashboard에서 담당 학생 모니터링",
      "Tutor 답변 신고 검토·후속 대응",
      "주간 보고 작성 (H3 KPI 측정)",
    ],
    resources: [
      { label: "/instructor/dashboard", href: "/instructor/dashboard" },
      { label: "/instructor/weekly-report (주간 보고)", href: "/instructor/weekly-report" },
      { label: "/studio (콘텐츠 생성)", href: "/studio" },
      { label: "runbook — 콘텐츠 관리", href: "/admin/runbook?doc=content-management" },
    ],
  },
  {
    role: "SME (도메인 전문가)",
    emoji: "🔬",
    hours: 4,
    audience: "콘텐츠 검토 — 정확성·적합성·시험 부합도",
    goals: [
      "주 2회 SME 메일 → /sme/dashboard 검토",
      "3축 평가 (정확성·적합성·시험부합도) 정확하게 입력",
      "평균 4.0/5 미달 시 보완 의견 작성",
      "학생 신고된 콘텐츠 사실 검증",
    ],
    resources: [
      { label: "/sme/dashboard", href: "/sme/dashboard" },
      { label: "runbook — 콘텐츠 관리", href: "/admin/runbook?doc=content-management" },
    ],
  },
];

export default async function TrainingProgramPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/training-program");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const totalHours = MODULES.reduce((s, m) => s + m.hours, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">전사 교육 프로그램</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            5개 직책별 모듈 · 총 {totalHours}시간 · ai-studio 도그푸딩으로 콘텐츠화 가능
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자</Link>
      </header>

      <div className="space-y-4">
        {MODULES.map((m) => (
          <Card key={m.role}>
            <CardHeader className="px-6 pt-6 pb-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">
                  <span className="mr-2">{m.emoji}</span>{m.role}
                </h2>
                <span className="text-sm font-mono text-muted-foreground">{m.hours}h</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{m.audience}</p>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">학습 목표</div>
                <ul className="space-y-1">
                  {m.goals.map((g) => (
                    <li key={g} className="flex items-start text-sm">
                      <span className="mr-2 text-emerald-600 mt-0.5">✓</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">실습 자료</div>
                <div className="flex flex-wrap gap-2">
                  {m.resources.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                    >
                      {r.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 text-sm">
          <p className="text-muted-foreground">
            💡 <strong>자체 도그푸딩</strong>: 각 모듈 콘텐츠는 Studio로 생성 가능. Studio에서
            course_category=&quot;professional&quot; 선택 → 주제 &quot;ai-studio 임원용 KPI 해석&quot; 등 입력 → 자동
            챕터 생성. SME(본부장) 검토 후 임원 교육 자료로 활용.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
