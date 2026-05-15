import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Department = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  matching_categories: string[];  // course_category 매핑
  primary_use: string;
  status: "active" | "planned" | "exploration";
};

const DEPARTMENTS: Department[] = [
  {
    id: "certification",
    name: "자격증 본부",
    emoji: "📜",
    description: "조리·미용·바리스타·요양보호 등 국가 자격증 대비",
    matching_categories: ["certification"],
    primary_use: "Studio로 시험 출제 경향 반영 콘텐츠 + Tutor 환각 차단",
    status: "active",
  },
  {
    id: "general",
    name: "일반 교육 본부",
    emoji: "🎯",
    description: "직무 교육·취미·라이프스킬",
    matching_categories: ["professional", "hobby"],
    primary_use: "어댑터 5종 중 professional·hobby — W9 시작, W11 확장",
    status: "active",
  },
  {
    id: "foreign",
    name: "외국인 교육 본부",
    emoji: "🌏",
    description: "외국인 대상 한국어·문화 교육",
    matching_categories: ["language"],
    primary_use: "Tutor 다국어 (ko·en·zh·vi·id) · language 어댑터",
    status: "active",
  },
  {
    id: "academic",
    name: "학술 교육 본부",
    emoji: "🎓",
    description: "수능·고등·중등 학습",
    matching_categories: ["academic"],
    primary_use: "academic 어댑터 (단계별 증명·연습문제). 미시작",
    status: "planned",
  },
  {
    id: "corporate",
    name: "기업 교육 본부",
    emoji: "🏢",
    description: "B2B 사내 교육 콘텐츠 납품",
    matching_categories: ["professional"],
    primary_use: "API 키 발급 → 외부 시스템 ai-studio 호출 (v0.40.0+)",
    status: "exploration",
  },
  {
    id: "content",
    name: "콘텐츠 본부",
    emoji: "📚",
    description: "교재 제작·디지털 콘텐츠",
    matching_categories: ["certification", "professional", "language", "hobby", "academic"],
    primary_use: "Studio 13 에이전트로 신규 교재 자동 초안 생성 → SME 검토",
    status: "active",
  },
];

export default async function DepartmentInsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/department-insights");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  // 카테고리별 실적 (department 매핑용)
  const admin = createAdminClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: jobs } = await admin
    .from("studio_jobs")
    .select("course_category, cost_usd, user_id")
    .gte("created_at", since30d)
    .is("deleted_at", null);

  const byCat: Record<string, { jobs: number; users: Set<string>; cost: number }> = {};
  for (const j of jobs ?? []) {
    const cat = j.course_category ?? "certification";
    if (!byCat[cat]) byCat[cat] = { jobs: 0, users: new Set(), cost: 0 };
    byCat[cat].jobs++;
    byCat[cat].users.add(j.user_id);
    byCat[cat].cost += Number(j.cost_usd ?? 0);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">부서별 활용 인사이트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KEG 6 본부 ai-studio 활용 매핑 (자격증 → 학술 → B2B 단계적 확장)
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자</Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEPARTMENTS.map((d) => {
          // 매핑된 카테고리 실적 합산
          const stats = d.matching_categories.reduce(
            (acc, cat) => {
              const s = byCat[cat];
              if (s) {
                acc.jobs += s.jobs;
                s.users.forEach((u) => acc.users.add(u));
                acc.cost += s.cost;
              }
              return acc;
            },
            { jobs: 0, users: new Set<string>(), cost: 0 },
          );
          const statusMeta = {
            active: { label: "운영 중", cls: "bg-emerald-100 text-emerald-700" },
            planned: { label: "계획", cls: "bg-amber-100 text-amber-700" },
            exploration: { label: "탐색", cls: "bg-zinc-200 text-zinc-700" },
          }[d.status];
          return (
            <Card key={d.id}>
              <CardHeader className="px-5 pt-5 pb-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold">
                    <span className="mr-2">{d.emoji}</span>{d.name}
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusMeta.cls}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{d.description}</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <p className="text-xs leading-relaxed">{d.primary_use}</p>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                  <Mini label="콘텐츠" value={stats.jobs.toString()} />
                  <Mini label="제작자" value={stats.users.size.toString()} />
                  <Mini label="30일 비용" value={`$${stats.cost.toFixed(0)}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 단계적 확장 권장 */}
      <Card>
        <CardHeader className="px-5 pt-5"><h2 className="text-base font-semibold">단계적 확장 권장</h2></CardHeader>
        <CardContent className="px-5 pb-5 space-y-2 text-sm">
          <p className="leading-relaxed">
            <strong>Phase 3 (현재)</strong>: 자격증·일반 본부 — 어댑터 5종 활용도 검증
          </p>
          <p className="leading-relaxed">
            <strong>Phase 4 후보</strong>: 외국인 본부 다국어 Tutor 강화 + 학술 본부 시범
          </p>
          <p className="leading-relaxed">
            <strong>Phase 5+</strong>: B2B 기업 교육 (API 키·SaaS화) → 컨텐츠 본부 도그푸딩
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
