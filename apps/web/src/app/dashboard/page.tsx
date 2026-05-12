import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { DAILY_USD_LIMIT, budgetSeverity } from "@/lib/limits";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin" | "sme" | "instructor";
};

type RecentJob = {
  id: string;
  topic: string;
  status: "pending" | "running" | "completed" | "failed";
  cost_usd: number | null;
  created_at: string;
};

type Stats = {
  totalJobs: number;
  successfulJobs: number;
  monthCost: number;
  todayCost: number;
};

async function getDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", user.id)
    .single<Profile>();

  const safeProfile: Profile = profile ?? {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.name as string | undefined) ?? null,
    role: "user",
  };

  // 통계 계산
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 총 / 성공 / 이번달 비용
  const [{ count: totalJobs }, { count: successfulJobs }, monthRes, todayRes] =
    await Promise.all([
      supabase
        .from("studio_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("studio_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .is("deleted_at", null),
      supabase
        .from("cost_log")
        .select("cost_usd")
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("cost_log")
        .select("cost_usd")
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString()),
    ]);

  const sumUsd = (rows: { cost_usd: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  const stats: Stats = {
    totalJobs: totalJobs ?? 0,
    successfulJobs: successfulJobs ?? 0,
    monthCost: sumUsd(monthRes.data),
    todayCost: sumUsd(todayRes.data),
  };

  // 최근 5개
  const { data: recent } = await supabase
    .from("studio_jobs")
    .select("id, topic, status, cost_usd, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    profile: safeProfile,
    stats,
    recent: (recent ?? []) as RecentJob[],
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  if (!data) redirect("/login");

  const { profile, stats, recent } = data;
  const greeting = profile.name ?? profile.email.split("@")[0];
  const successRate =
    stats.totalJobs > 0 ? (stats.successfulJobs / stats.totalJobs) * 100 : 0;
  const budgetPct = Math.min((stats.todayCost / DAILY_USD_LIMIT) * 100, 100);
  const sev = budgetSeverity(stats.todayCost);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          안녕하세요, <span>{greeting}</span>님
        </h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{profile.email}</span>
          {profile.role === "admin" && (
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest">
              Admin
            </span>
          )}
        </p>
      </div>

      {/* Stats 3카드 */}
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              총 작업
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {stats.totalJobs}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">건 (삭제 제외)</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              이번 달 비용
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              ${stats.monthCost.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">USD · 이번 달 누적</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              성공률
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {successRate.toFixed(0)}
              <span className="text-xl">%</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.successfulJobs} / {stats.totalJobs}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Budget Progress */}
      <Card className="mb-8 border-border/60 bg-card/80">
        <CardContent className="p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              오늘 사용 한도
            </p>
            <p className="font-mono text-sm tabular-nums text-foreground">
              <span
                className={
                  sev === "block"
                    ? "text-red-300"
                    : sev === "warn"
                      ? "text-yellow-300"
                      : "text-foreground"
                }
              >
                ${stats.todayCost.toFixed(4)}
              </span>{" "}
              <span className="text-muted-foreground">
                / ${DAILY_USD_LIMIT.toFixed(2)}
              </span>
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className={`h-full transition-all duration-500 ${
                sev === "block"
                  ? "bg-red-400"
                  : sev === "warn"
                    ? "bg-yellow-400"
                    : "bg-foreground"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          {sev === "block" && (
            <p className="mt-3 text-xs text-red-300">
              ⚠️ 일일 한도 도달 — 새 작업 생성이 차단됩니다. 자정 이후 재개.
            </p>
          )}
          {sev === "warn" && (
            <p className="mt-3 text-xs text-yellow-300">
              ⚠️ 일일 한도 80% 도달 — 곧 차단될 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 빠른 액션 + 최근 작업 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 액션 카드 */}
        <Link
          href="/studio"
          className="group rounded-lg border border-border/60 bg-card/80 p-6 transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-2xl hover:shadow-foreground/5"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            New
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Studio로 콘텐츠 만들기
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            2개 에이전트가 협업하여 챕터 본문 + 슬라이드를 자동 생성.
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-widest text-foreground">
            시작 →
          </p>
        </Link>

        <Link
          href="/dashboard/history"
          className="group rounded-lg border border-border/60 bg-card/80 p-6 transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-2xl hover:shadow-foreground/5"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            내 작업 기록
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            과거 작업 조회·재실행·공유. 총 {stats.totalJobs}건.
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-widest text-foreground">
            보기 →
          </p>
        </Link>

        <Link
          href="/cast"
          className="group rounded-lg border border-border/60 bg-card/80 p-6 transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-2xl hover:shadow-foreground/5"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Cast
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            영상 강의 만들기
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Studio 콘텐츠 → 아바타 + PPT 영상으로 변환.
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-widest text-foreground">
            시작 →
          </p>
        </Link>
      </div>

      {/* 학습 + 케어 도구 */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/tutor"
          className="rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card hover:border-foreground/30"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Tutor</p>
          <p className="mt-1 text-sm font-semibold">질문하기 →</p>
          <p className="mt-1 text-xs text-muted-foreground">24/7 1:1 답변</p>
        </Link>
        <Link
          href="/dashboard/self-check"
          className="rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card hover:border-foreground/30"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">자가 진단</p>
          <p className="mt-1 text-sm font-semibold">주 1회 →</p>
          <p className="mt-1 text-xs text-muted-foreground">학습 만족도</p>
        </Link>
        <Link
          href="/dashboard/nps"
          className="rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card hover:border-foreground/30"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">추천 설문</p>
          <p className="mt-1 text-sm font-semibold">2분 응답 →</p>
          <p className="mt-1 text-xs text-muted-foreground">NPS 0~10</p>
        </Link>
        <Link
          href="/support"
          className="rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card hover:border-foreground/30"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">문의</p>
          <p className="mt-1 text-sm font-semibold">문의 보내기 →</p>
          <p className="mt-1 text-xs text-muted-foreground">24h 응대</p>
        </Link>
      </div>

      {/* 역할별 빠른 진입 */}
      {(profile.role === "admin" || profile.role === "sme" || profile.role === "instructor") && (
        <div className="mt-6 flex flex-wrap gap-2">
          {profile.role === "admin" && (
            <Link href="/admin" className="rounded-md border border-foreground/30 bg-foreground/5 px-4 py-2 text-sm font-medium hover:bg-foreground/10">
              🛠 관리자 패널 →
            </Link>
          )}
          {profile.role === "sme" && (
            <Link href="/sme/dashboard" className="rounded-md border border-foreground/30 bg-foreground/5 px-4 py-2 text-sm font-medium hover:bg-foreground/10">
              📋 SME 검토 대시보드 →
            </Link>
          )}
          {profile.role === "instructor" && (
            <Link href="/instructor/weekly-report" className="rounded-md border border-foreground/30 bg-foreground/5 px-4 py-2 text-sm font-medium hover:bg-foreground/10">
              📝 강사 주간 보고 →
            </Link>
          )}
        </div>
      )}

      {/* 최근 작업 목록 */}
      {recent.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              최근 작업
            </p>
            <Link
              href="/dashboard/history"
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
            <ul className="divide-y divide-border/40">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/dashboard/history/${j.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-card/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{j.topic}</p>
                      <p className="font-mono text-xs text-muted-foreground/70">
                        {new Date(j.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      {j.cost_usd != null && (
                        <span className="font-mono tabular-nums text-muted-foreground">
                          ${j.cost_usd.toFixed(4)}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                          j.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : j.status === "failed"
                              ? "bg-red-500/10 text-red-300"
                              : "bg-foreground/10 text-foreground"
                        }`}
                      >
                        {j.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
