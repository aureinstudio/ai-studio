import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TutorClient } from "./TutorClient";

export const dynamic = "force-dynamic";

type StudioJobOption = {
  id: string;
  topic: string;
  level: string;
  is_indexed: boolean;
};

export default async function TutorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tutor");

  // 본인 완료된 Studio 작업 + 샘플
  const { data: myJobs } = await supabase
    .from("studio_jobs")
    .select("id, topic, level")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: sampleJobs } = await supabase
    .from("studio_jobs")
    .select("id, topic, level")
    .eq("is_sample", true)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  // 인덱싱 여부 — rag_embeddings에 행이 있는 작업
  const jobIds = [...(myJobs ?? []), ...(sampleJobs ?? [])].map((j) => j.id);
  const { data: indexed } = await supabase
    .from("rag_embeddings")
    .select("studio_job_id")
    .in("studio_job_id", jobIds);
  const indexedSet = new Set((indexed ?? []).map((r) => r.studio_job_id));

  const options: StudioJobOption[] = [
    ...(myJobs ?? []).map((j) => ({
      id: j.id,
      topic: j.topic,
      level: j.level,
      is_indexed: indexedSet.has(j.id),
    })),
    ...(sampleJobs ?? []).map((j) => ({
      id: j.id,
      topic: `[샘플] ${j.topic}`,
      level: j.level,
      is_indexed: indexedSet.has(j.id),
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Tutor · 1:1 AI 학습 도우미
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          교재 기반 질문 답변
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Studio가 생성한 교재를 RAG (벡터 검색)으로 인덱싱 후, 학생 질문에
          교재 근거로 답변합니다. 모든 응답은{" "}
          <span className="text-foreground">#08 환각 검증</span>을 통과한 안전한 답변만 전달됩니다.
        </p>
      </div>

      <TutorClient courseOptions={options} />
    </div>
  );
}
