import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SuperAdminDashboard } from "./SuperAdminDashboard";

export const dynamic = "force-dynamic";

type Role =
  | "user"
  | "customer"
  | "admin"
  | "keg_super_admin"
  | "tenant_admin"
  | "sme"
  | "operations"
  | "instructor"
  | "creator";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

type Enrollment = {
  id: string;
  studio_job_id: string;
  topic: string;
  course_category: string;
  enrolled_at: string;
};

// keg_super_admin은 redirect하지 않고 통합 대시보드 노출 (모든 기능 접근).
// tenant_admin도 동일하게 통합 뷰 노출.
const ROLE_HOME: Partial<Record<Role, string>> = {
  admin: "/admin",
  sme: "/sme/dashboard",
  operations: "/sme/dashboard",
  instructor: "/instructor/dashboard",
  creator: "/instructor/dashboard",
};

const SUPER_ROLES = new Set<Role>(["keg_super_admin", "tenant_admin"]);

async function resolveProfile(): Promise<Profile | null> {
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

  return (
    profile ?? {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string | undefined) ?? null,
      role: "user",
    }
  );
}

async function getStudentData(profile: Profile) {
  const supabase = await createClient();
  const user = { id: profile.id };

  // 수강 중인 과정 (학습자 핵심 데이터)
  const { data: enrollmentRows } = await supabase
    .from("student_enrollments")
    .select(
      "id, studio_job_id, status, enrolled_at, studio_jobs!inner(topic, course_category)",
    )
    .eq("student_id", user.id)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false })
    .limit(12);

  type ER = {
    id: string;
    studio_job_id: string;
    status: string;
    enrolled_at: string;
    studio_jobs?:
      | { topic: string; course_category: string }
      | { topic: string; course_category: string }[]
      | null;
  };
  const enrollments: Enrollment[] = (enrollmentRows ?? []).map((r) => {
    const row = r as unknown as ER;
    const job = Array.isArray(row.studio_jobs) ? row.studio_jobs[0] : row.studio_jobs;
    return {
      id: row.id,
      studio_job_id: row.studio_job_id,
      topic: job?.topic ?? "(주제 미상)",
      course_category: job?.course_category ?? "certification",
      enrolled_at: row.enrolled_at,
    };
  });

  // 학습 활동 통계 — 최근 활성 대화 + 누적 메시지
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [conv7d, conv30d] = await Promise.all([
    supabase
      .from("tutor_conversations")
      .select("total_messages")
      .eq("student_id", user.id)
      .gte("last_active_at", since7d),
    supabase
      .from("tutor_conversations")
      .select("total_messages")
      .eq("student_id", user.id)
      .gte("last_active_at", since30d),
  ]);
  const sumMsgs = (rows: { total_messages: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.total_messages ?? 0), 0);

  return {
    enrollments,
    activity: {
      msg7d: sumMsgs(conv7d.data),
      msg30d: sumMsgs(conv30d.data),
    },
  };
}

export default async function DashboardPage() {
  const profile = await resolveProfile();
  if (!profile) redirect("/login");

  // keg_super_admin / tenant_admin → 통합 대시보드 (모든 기능 노출)
  if (SUPER_ROLES.has(profile.role)) {
    return <SuperAdminDashboard profile={profile} />;
  }

  // admin / sme / instructor → 전용 홈으로 redirect
  const redirectTo = ROLE_HOME[profile.role];
  if (redirectTo) redirect(redirectTo);

  // user / customer / 기타 → 학습자 뷰
  const data = await getStudentData(profile);
  const { enrollments, activity } = data;
  const greeting = profile.name ?? profile.email.split("@")[0];
  const latest = enrollments[0];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          My Learning
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          안녕하세요, <span>{greeting}</span>님
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          오늘도 학습을 이어가 보세요.
        </p>
      </div>

      {/* 학습 이어가기 hero — 최근 수강 과정 1개 */}
      {latest && (
        <Link
          href={`/learn/${latest.studio_job_id}`}
          className="mb-8 block rounded-xl border-2 border-foreground/20 bg-gradient-to-br from-card via-card/80 to-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-xl"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            ▶ 학습 이어가기
          </p>
          <h2 className="text-2xl font-bold tracking-tight">{latest.topic}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            강의 콘텐츠로 이동합니다. 거기서 AI Tutor에게 질문도 가능합니다.
          </p>
        </Link>
      )}

      {/* 학습 활동 통계 */}
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              수강 중
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {enrollments.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">개 과정 (활성)</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              이번 주 질문
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {activity.msg7d}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">건 · 최근 7일</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              월간 활동
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {activity.msg30d}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">건 · 최근 30일</p>
          </CardContent>
        </Card>
      </div>

      {/* 학습 도구 */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* 수강 중인 과정 grid */}
      <div className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            수강 중인 과정 ({enrollments.length})
          </p>
          <Link
            href="/courses"
            className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
          >
            + 과정 추가
          </Link>
        </div>
        {enrollments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
            아직 수강 중인 과정이 없습니다.{" "}
            <Link href="/courses" className="text-foreground underline-offset-4 hover:underline">
              카탈로그에서 수강 신청
            </Link>
            을 시작하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e) => (
              <Link
                key={e.id}
                href={`/learn/${e.studio_job_id}`}
                className="rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card hover:border-foreground/30"
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {e.course_category}
                </div>
                <div className="mt-1 text-sm font-medium leading-tight">{e.topic}</div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  등록 {new Date(e.enrolled_at).toLocaleDateString()} · 학습 →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
