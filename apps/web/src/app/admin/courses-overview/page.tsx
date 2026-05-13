import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CATEGORY_OPTIONS, type CourseCategory } from "@/lib/agents/studio/adapters";

export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  topic: string;
  course_category: CourseCategory;
  status: string;
  cost_usd: number | null;
  user_id: string;
  created_at: string;
};

type Stats = {
  jobs: number;
  completed: number;
  failed: number;
  total_cost: number;
  unique_users: Set<string>;
};

export default async function CoursesOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/courses-overview");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: jobs } = await admin
    .from("studio_jobs")
    .select("id, topic, course_category, status, cost_usd, user_id, created_at")
    .gte("created_at", since30d)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // 카테고리별 집계
  const byCategory: Record<string, Stats> = {};
  for (const opt of CATEGORY_OPTIONS) {
    byCategory[opt.value] = {
      jobs: 0,
      completed: 0,
      failed: 0,
      total_cost: 0,
      unique_users: new Set(),
    };
  }
  for (const r of (jobs ?? []) as JobRow[]) {
    const cat = r.course_category ?? "certification";
    if (!byCategory[cat]) continue;
    const s = byCategory[cat];
    s.jobs++;
    if (r.status === "completed") s.completed++;
    if (r.status === "failed") s.failed++;
    s.total_cost += Number(r.cost_usd ?? 0);
    s.unique_users.add(r.user_id);
  }

  // 주제별 상위 5건 (각 카테고리)
  const topicsByCategory: Record<string, { topic: string; count: number }[]> = {};
  for (const r of (jobs ?? []) as JobRow[]) {
    const cat = r.course_category ?? "certification";
    if (!topicsByCategory[cat]) topicsByCategory[cat] = [];
    const exist = topicsByCategory[cat].find((t) => t.topic === r.topic);
    if (exist) exist.count++;
    else topicsByCategory[cat].push({ topic: r.topic, count: 1 });
  }

  const totalCost = Object.values(byCategory).reduce((s, c) => s + c.total_cost, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">과정 카테고리 통합 (30일)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 3 어댑테이션 — 5개 카테고리별 콘텐츠 생성 통계
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/studio" className="px-4 py-2 text-sm rounded bg-foreground text-background">+ 새 콘텐츠</Link>
          <Link href="/admin" className="text-sm hover:underline self-center text-muted-foreground">← 관리자</Link>
        </div>
      </header>

      {/* 카테고리 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORY_OPTIONS.map((opt) => {
          const s = byCategory[opt.value];
          const successRate = s.jobs > 0 ? (s.completed / s.jobs) * 100 : 0;
          const avgCost = s.completed > 0 ? s.total_cost / s.completed : 0;
          return (
            <Card key={opt.value}>
              <CardHeader className="px-5 pt-5 pb-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold">{opt.label}</h2>
                  <span className="text-xs font-mono text-muted-foreground">{opt.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.example}</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="콘텐츠" value={s.jobs.toString()} />
                  <Stat label="성공" value={`${successRate.toFixed(0)}%`} highlight={successRate >= 80 ? "good" : successRate < 50 ? "bad" : "neutral"} />
                  <Stat label="학생" value={s.unique_users.size.toString()} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>총 비용</span>
                  <span className="font-mono">${s.total_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>건당 평균</span>
                  <span className="font-mono">${avgCost.toFixed(3)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 총계 */}
      <Card>
        <CardContent className="p-5 flex flex-wrap gap-6">
          <div>
            <div className="text-xs uppercase text-muted-foreground">총 콘텐츠</div>
            <div className="text-2xl font-bold">{(jobs ?? []).length}건</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">활성 학생 (30일)</div>
            <div className="text-2xl font-bold">
              {new Set((jobs ?? []).map((j) => j.user_id)).size}명
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">총 비용 (30일)</div>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      {/* 카테고리별 상위 주제 */}
      {CATEGORY_OPTIONS.map((opt) => {
        const topics = (topicsByCategory[opt.value] ?? [])
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        if (topics.length === 0) return null;
        return (
          <Card key={`topics-${opt.value}`}>
            <CardHeader className="px-5 pt-5 pb-1">
              <h3 className="text-sm font-semibold">{opt.label} — 인기 주제 Top 5</h3>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ul className="space-y-1 text-sm">
                {topics.map((t) => (
                  <li key={t.topic} className="flex justify-between border-b py-1">
                    <span className="truncate max-w-[80%]">{t.topic}</span>
                    <span className="font-mono text-muted-foreground">{t.count}건</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const cls =
    highlight === "good" ? "text-emerald-600" :
    highlight === "bad" ? "text-red-600" :
    "";
  return (
    <div className="p-2 bg-muted/30 rounded">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}
