import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SampleRow = {
  id: string;
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  sample_label: string | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  created_at: string;
};

const LEVEL_LABEL = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
} as const;

export default async function SamplesPage() {
  const supabase = await createClient();
  const { data: samples } = await supabase
    .from("studio_jobs")
    .select("id, topic, level, sample_label, cost_usd, duration_seconds, created_at")
    .eq("is_sample", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .returns<SampleRow[]>();

  const items = samples ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Studio · SME Review
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          샘플 콘텐츠 검토
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          KEG Studio가 13 에이전트 협업으로 생성한 자격증·강의 콘텐츠 샘플입니다.
          시니어 강사·도메인 전문가께서 각 샘플을 검토하시고 5점 척도로 평가해주세요.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              아직 공개된 샘플이 없습니다. 본부장이 곧 샘플 콘텐츠를 생성합니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Link
              key={s.id}
              href={`/samples/${s.id}`}
              className="block rounded-lg border border-border/60 bg-card/80 p-5 transition-colors hover:border-foreground/30 hover:bg-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {s.sample_label && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
                        {s.sample_label}
                      </span>
                    )}
                    <span>{LEVEL_LABEL[s.level]}</span>
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">{s.topic}</h2>
                </div>
                <div className="text-right font-mono text-xs text-muted-foreground">
                  {s.duration_seconds && (
                    <p>⚡ {s.duration_seconds.toFixed(0)}s</p>
                  )}
                  {s.cost_usd && <p>💵 ${s.cost_usd.toFixed(3)}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        평가 데드라인: 자세한 일정은 본부장 안내를 따릅니다.
      </p>
    </div>
  );
}
