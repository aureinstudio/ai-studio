import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CastClient } from "./CastClient";

export const dynamic = "force-dynamic";

type StudioJobRow = {
  id: string;
  topic: string;
  level: string;
  duration_seconds: number | null;
  created_at: string;
  content: {
    planner?: { slides?: unknown[] };
    team2?: { planner?: { slides?: unknown[] } };
  } | null;
};

export default async function CastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cast");

  // 사용자의 완료된 Studio 작업 — 최근 20건
  const { data: studioJobs } = await supabase
    .from("studio_jobs")
    .select("id, topic, level, duration_seconds, created_at, content")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<StudioJobRow[]>();

  // 슬라이드가 있는 작업만 노출
  const eligible = (studioJobs ?? [])
    .map((j) => {
      const slides =
        j.content?.planner?.slides ?? j.content?.team2?.planner?.slides ?? [];
      return { ...j, slideCount: slides.length };
    })
    .filter((j) => j.slideCount > 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Cast · PPT → Video
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          영상 변환
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Studio에서 생성한 슬라이드를 강의 스크립트로 변환합니다.
          TEAM 1 (분석·스크립트) 단계 — 음성·영상 생성은 다음 단계.
        </p>
      </div>

      <CastClient studioJobs={eligible} />
    </div>
  );
}
