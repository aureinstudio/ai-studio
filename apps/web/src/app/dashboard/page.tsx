import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// 사용자별 동적 페이지 — 정적 캐싱 비활성화
export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
};

async function getProfile(): Promise<Profile | null> {
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

  // profiles 트리거가 아직 적용 안 됐어도 페이지가 깨지지 않도록 폴백
  return (
    profile ?? {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string | undefined) ?? null,
      role: "user",
    }
  );
}

type DashboardCard = {
  title: string;
  description: string;
  cta: string;
  state: "active" | "empty" | "disabled" | "admin";
};

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const cards: DashboardCard[] = [
    {
      title: "Studio로 콘텐츠 만들기",
      description:
        "13개 AI 에이전트로 교재·슬라이드·퀴즈를 동시 생성. 자료 기획부터 최종 품질 검토까지.",
      cta: "곧 출시",
      state: "disabled",
    },
    {
      title: "내 작업 기록",
      description:
        "지금까지 만든 콘텐츠와 진행 중인 작업을 확인합니다.",
      cta: "비어있음",
      state: "empty",
    },
    ...(profile.role === "admin"
      ? [
          {
            title: "관리자 패널",
            description:
              "사용자 관리, 시스템 설정, KPI 모니터링.",
            cta: "관리",
            state: "admin" as const,
          },
        ]
      : []),
  ];

  const greeting = profile.name ?? profile.email.split("@")[0];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.title}
            className={`border-border/60 bg-card/80 transition-all duration-300 ${
              card.state === "disabled"
                ? "opacity-60"
                : "hover:-translate-y-1 hover:border-foreground/30 hover:shadow-2xl hover:shadow-foreground/5"
            }`}
          >
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                {card.description}
              </CardDescription>
              <p
                className={`mt-4 text-xs font-medium uppercase tracking-widest ${
                  card.state === "disabled"
                    ? "text-muted-foreground/50"
                    : card.state === "empty"
                      ? "text-muted-foreground"
                      : "text-foreground"
                }`}
              >
                {card.cta}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
