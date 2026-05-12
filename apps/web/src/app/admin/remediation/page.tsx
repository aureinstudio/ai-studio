import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import RemediationActions from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  studio_job_id: string;
  reason: string;
  avg_score: number | null;
  improvements: string | null;
  status: "pending" | "regenerating" | "regenerated" | "dismissed";
  new_studio_job_id: string | null;
  created_at: string;
  job?: { topic: string; level: string; length: string };
};

const STATUS_LABEL: Record<Row["status"], { label: string; cls: string }> = {
  pending: { label: "대기", cls: "bg-amber-100 text-amber-800" },
  regenerating: { label: "재생성 중", cls: "bg-blue-100 text-blue-800" },
  regenerated: { label: "재생성 완료", cls: "bg-emerald-100 text-emerald-800" },
  dismissed: { label: "보류", cls: "bg-zinc-200 text-zinc-700" },
};

export default async function RemediationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/remediation");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const { data: queue } = await admin
    .from("content_remediation_queue")
    .select("id, studio_job_id, reason, avg_score, improvements, status, new_studio_job_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  // job 정보 join
  const rows = (queue ?? []) as Row[];
  const jobIds = Array.from(new Set(rows.map((r) => r.studio_job_id)));
  const { data: jobs } = jobIds.length
    ? await admin.from("studio_jobs").select("id, topic, level, length").in("id", jobIds)
    : { data: [] };
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
  for (const r of rows) {
    const j = jobById.get(r.studio_job_id);
    if (j) r.job = { topic: j.topic, level: j.level, length: j.length };
  }

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    regenerating: rows.filter((r) => r.status === "regenerating").length,
    regenerated: rows.filter((r) => r.status === "regenerated").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">콘텐츠 보완 큐</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SME 합격선 4.0/5 미달 시 자동 등록. 수동 승인 시 Studio 재생성 실행.
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자 홈</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="p-5 text-center">
              <div className="text-xs uppercase text-muted-foreground">{v.label}</div>
              <div className="mt-2 text-3xl font-bold">{counts[k as Row["status"]]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">목록</h2></CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">보완 큐 비어있음. 👍</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const meta = STATUS_LABEL[r.status];
                return (
                  <li key={r.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="font-semibold">{r.job?.topic ?? r.studio_job_id.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        평균 <span className="font-mono">{r.avg_score?.toFixed(1) ?? "—"}/5</span> ·
                        사유 {r.reason} ·
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                      {r.improvements && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">개선 의견 보기</summary>
                          <p className="mt-1 p-2 bg-muted rounded">{r.improvements}</p>
                        </details>
                      )}
                      {r.new_studio_job_id && (
                        <Link
                          href={`/sme/review/${r.new_studio_job_id}`}
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          재생성 결과 보기 →
                        </Link>
                      )}
                    </div>
                    <RemediationActions queueId={r.id} status={r.status} studioJobId={r.studio_job_id} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
