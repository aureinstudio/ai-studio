import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Understanding = {
  id: string;
  studio_job_id: string;
  overall_score: number;
  by_chapter: { chapter: string; score: number; weak_concepts?: string[] }[] | null;
  weak_concepts: string[] | null;
  learning_style: string | null;
  recommended_focus: string[] | null;
  estimated_exam_readiness: number | null;
  trend: "improving" | "stable" | "declining" | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendation: any;
  evaluated_at: string;
};

export default async function LearningDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/learning");

  const { data: latest } = await supabase
    .from("tutor_understanding")
    .select("*")
    .eq("student_id", user.id)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .returns<Understanding[]>();

  const u = latest?.[0];

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Learning · 학습 진단
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          나의 학습 현황
        </h1>
      </div>

      {!u ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            아직 평가된 학습 기록이 없습니다.{" "}
            <Link href="/tutor" className="text-foreground underline">
              /tutor
            </Link>{" "}
            에서 4번 이상 대화한 후 "이해도 평가" 버튼을 클릭하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 전체 점수 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="전체 이해도"
              value={`${u.overall_score}`}
              sub="/ 100"
              color={u.overall_score >= 70 ? "emerald" : u.overall_score >= 50 ? "amber" : "red"}
            />
            <StatCard
              label="시험 준비도"
              value={u.estimated_exam_readiness ? `${u.estimated_exam_readiness}` : "—"}
              sub="/ 100"
              color={(u.estimated_exam_readiness ?? 0) >= 70 ? "emerald" : "amber"}
            />
            <StatCard
              label="추세"
              value={
                u.trend === "improving"
                  ? "↑ 향상"
                  : u.trend === "declining"
                    ? "↓ 정체"
                    : "→ 유지"
              }
              color={u.trend === "improving" ? "emerald" : u.trend === "declining" ? "red" : "neutral"}
            />
            <StatCard
              label="마지막 평가"
              value={new Date(u.evaluated_at).toLocaleDateString("ko-KR")}
              color="neutral"
            />
          </div>

          {/* 챕터별 점수 */}
          {u.by_chapter && u.by_chapter.length > 0 && (
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  챕터별 이해도
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {u.by_chapter.map((ch, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{ch.chapter}</span>
                      <span className="font-mono text-muted-foreground">
                        {ch.score}/100
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          ch.score >= 80
                            ? "bg-emerald-400"
                            : ch.score >= 60
                              ? "bg-amber-400"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${ch.score}%` }}
                      />
                    </div>
                    {ch.weak_concepts && ch.weak_concepts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        약점: {ch.weak_concepts.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 약점 영역 */}
          {u.weak_concepts && u.weak_concepts.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-amber-300">
                  주의 영역 (반복 학습 권장)
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-foreground/90">
                  {u.weak_concepts.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-400">⚠</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 학습 스타일 */}
          {u.learning_style && (
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  학습 스타일 관찰
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90">{u.learning_style}</p>
              </CardContent>
            </Card>
          )}

          {/* 학습 권장 */}
          {u.recommendation && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
                  다음 학습 단계 (#06 권장)
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {u.recommendation.motivational_message && (
                  <p className="rounded-md bg-background/40 p-3 text-sm italic text-foreground/90">
                    💌 {u.recommendation.motivational_message}
                  </p>
                )}
                {u.recommendation.immediate_actions?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      즉시 할 일
                    </p>
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {u.recommendation.immediate_actions.map((a: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-md border border-border/40 bg-background/40 p-3"
                        >
                          <span
                            className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                              a.priority === "high"
                                ? "bg-red-500/10 text-red-300"
                                : a.priority === "medium"
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-emerald-500/10 text-emerald-300"
                            }`}
                          >
                            {a.action_type}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{a.target}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {a.rationale}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              {a.estimated_duration_minutes}분 · {a.priority}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "amber" | "red" | "neutral";
}) {
  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
    neutral: "border-border/60 bg-card/80",
  };
  return (
    <Card className={colorClasses[color]}>
      <CardContent className="p-4">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-2xl font-semibold text-foreground">
          {value}
          {sub && <span className="ml-1 text-sm text-muted-foreground">{sub}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
