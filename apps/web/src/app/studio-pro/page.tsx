import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UploadForm from "./upload-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio-pro");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin", "sme", "creator"].includes(profile?.role ?? "")) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">권한 없음</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Studio Pro는 강사·SME·콘텐츠 제작 권한이 필요합니다.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("studio_pro_jobs")
    .select("id, title, status, created_at, studio_job_id, cast_job_id, error")
    .eq("instructor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">v0.43 Skeleton</span>
          <span className="text-xs text-muted-foreground">강사 자료 → AI 보강 → 영상 합성</span>
        </div>
        <h1 className="text-3xl font-bold">Studio Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          본인 강의 자료를 업로드하면 AI가 보강하고 영상까지 합성합니다. 강사 IP를 유지하면서 효율을 ↑.
        </p>
      </header>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">새 작업 시작</h2>
        <UploadForm />
        <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <b>지원 형식:</b> .md / .txt / .pdf / .pptx — 최대 20 MB<br />
          <b>처리:</b> 텍스트 추출 → Studio orchestrator로 AI 보강 → (v0.47+) Cast 자동 영상 합성
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3">
          <h2 className="font-semibold">최근 작업 ({recent?.length ?? 0})</h2>
        </div>
        {(!recent || recent.length === 0) ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">아직 작업이 없습니다.</div>
        ) : (
          <ul className="divide-y">
            {recent.map((j) => (
              <li key={j.id} className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  <span className="font-medium">{j.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(j.created_at).toLocaleString("ko-KR")}
                  {j.studio_job_id && (
                    <Link href={`/dashboard/history/${j.studio_job_id}`} className="ml-2 text-blue-600 hover:underline">
                      Studio 결과 →
                    </Link>
                  )}
                  {j.cast_job_id && (
                    <Link href={`/dashboard/history/cast`} className="ml-2 text-blue-600 hover:underline">
                      Cast 영상 →
                    </Link>
                  )}
                </div>
                {j.error && (
                  <div className="mt-1 text-xs text-red-600">에러: {j.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    uploaded: "bg-zinc-100 text-zinc-700",
    extracting: "bg-blue-100 text-blue-700",
    enhancing: "bg-purple-100 text-purple-700",
    synthesizing_video: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  const label: Record<string, string> = {
    uploaded: "업로드됨",
    extracting: "추출 중",
    enhancing: "AI 보강 중",
    synthesizing_video: "영상 합성 중",
    completed: "완료 ✓",
    failed: "실패",
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${cls[status] ?? cls.uploaded}`}>{label[status] ?? status}</span>;
}
