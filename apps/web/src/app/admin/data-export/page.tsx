import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const DATASETS = [
  { key: "kpi_metrics", label: "일일 KPI 스냅샷", desc: "kpi_metrics 전체 — 학생·콘텐츠·비용·환각 차단" },
  { key: "hypothesis_metrics", label: "가설 시계열", desc: "5개 가설 측정 이력" },
  { key: "cost_log", label: "비용 상세", desc: "service·endpoint·model·tokens 단위" },
  { key: "sme_evaluations", label: "SME 평가 이력", desc: "3축 점수 + 개선 의견" },
  { key: "nps_responses", label: "NPS 응답", desc: "익명 — user_id 해시 처리" },
  { key: "student_feedback", label: "자가 진단", desc: "주간 만족도·어려움·기타 의견" },
  { key: "incidents", label: "인시던트 이력", desc: "L1~L4 + 카테고리 + 해결 여부" },
] as const;

export default async function DataExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/data-export");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">데이터 내보내기</h1>
          <p className="mt-1 text-sm text-muted-foreground">CSV·JSON 다운로드 · 학생 식별자는 해시 처리</p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자 홈</Link>
      </header>

      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">사용 가능 데이터셋</h2></CardHeader>
        <CardContent className="px-6 pb-6">
          <ul className="divide-y">
            {DATASETS.map((d) => (
              <li key={d.key} className="py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{d.key}</div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/api/admin/data-export?dataset=${d.key}&format=csv`}
                    className="px-3 py-1.5 text-xs rounded bg-foreground text-background hover:opacity-90"
                  >
                    CSV ↓
                  </a>
                  <a
                    href={`/api/admin/data-export?dataset=${d.key}&format=json`}
                    className="px-3 py-1.5 text-xs rounded border hover:bg-muted"
                  >
                    JSON ↓
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">G2 Final Report</h2></CardHeader>
        <CardContent className="px-6 pb-6 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <a href="/admin/g2-final-report" className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white">웹 보기</a>
            <a href="/api/admin/g2-final-report" className="px-3 py-1.5 text-xs rounded border">JSON ↓</a>
          </div>
          <p className="text-xs text-muted-foreground">PDF는 웹 보기 → 인쇄 → "PDF로 저장" 옵션 사용 (브라우저 기본 기능).</p>
        </CardContent>
      </Card>
    </div>
  );
}
