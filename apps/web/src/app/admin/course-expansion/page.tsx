import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UpdateProgressForm from "./update-progress-form";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  planned: "bg-zinc-100 text-zinc-700",
  content_migration: "bg-blue-100 text-blue-700",
  sme_review: "bg-purple-100 text-purple-700",
  beta: "bg-amber-100 text-amber-700",
  live: "bg-emerald-100 text-emerald-700",
  retired: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  planned: "계획",
  content_migration: "콘텐츠 마이그레이션",
  sme_review: "SME 검토",
  beta: "베타",
  live: "운영 중",
  retired: "종료",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin" && profile?.role !== "operations") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("course_catalog")
    .select("id, slug, name, course_category, status, target_students, migration_progress_pct, planned_launch_date, actual_launch_date, notes")
    .order("status", { ascending: true })
    .order("planned_launch_date", { ascending: true, nullsFirst: false });

  const live = (courses ?? []).filter((c) => c.status === "live").length;
  const planned = (courses ?? []).filter((c) => c.status === "planned").length;
  const inProgress = (courses ?? []).filter((c) => ["content_migration", "sme_review", "beta"].includes(c.status)).length;
  const avgProgress = courses && courses.length > 0
    ? Math.round(courses.reduce((s, c) => s + c.migration_progress_pct, 0) / courses.length)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W21 · EXPAND</span>
        <h1 className="mt-1 text-3xl font-bold">과정 확장 트래킹</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          5개 운영 중 + 5개 신규 = <b>10개 과정 동시 운영</b> 목표. 마이그레이션 진척 + 강사 배정 통합 관리.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="전체 슬롯" value={(courses?.length ?? 0).toString()} target="/ 10" />
        <Stat label="운영 중" value={live.toString()} cls="text-emerald-600" />
        <Stat label="진행 중" value={inProgress.toString()} cls="text-blue-600" />
        <Stat label="평균 진척" value={`${avgProgress}%`} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left">과정</th>
              <th className="px-4 py-3 text-left">카테고리</th>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-left w-48">마이그레이션</th>
              <th className="px-4 py-3 text-right">목표 학생</th>
              <th className="px-4 py-3 text-left">출시 예정</th>
              <th className="px-4 py-3 text-left">액션</th>
            </tr>
          </thead>
          <tbody>
            {(courses ?? []).map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
                </td>
                <td className="px-4 py-3 text-xs">{c.course_category}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${c.migration_progress_pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${c.migration_progress_pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs">{c.migration_progress_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">{c.target_students ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {c.actual_launch_date
                    ? <span className="text-emerald-600">✓ {new Date(c.actual_launch_date).toLocaleDateString("ko-KR")}</span>
                    : c.planned_launch_date
                      ? new Date(c.planned_launch_date).toLocaleDateString("ko-KR")
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  <UpdateProgressForm id={c.id} currentStatus={c.status} currentProgress={c.migration_progress_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 rounded-lg border bg-amber-50 p-4 text-sm">
        <h3 className="mb-2 font-semibold text-amber-900">⚠ 확장 운영 체크리스트</h3>
        <ul className="ml-4 list-disc space-y-1 text-xs text-amber-800">
          <li>강사 5명 추가 영입 → <a className="underline" href="/admin/recruitment">/admin/recruitment</a></li>
          <li>학생 1,000명 목표 → 카카오·페이스북 광고 캠페인 가동</li>
          <li>추천 인센티브 → <a className="underline" href="/admin/referrals">/admin/referrals</a> 코드 발급</li>
          <li>10 과정 동시 운영 매뉴얼 → /admin/runbook 업데이트</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, target, cls }: { label: string; value: string; target?: string; cls?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${cls ?? ""}`}>{value}</span>
        {target && <span className="text-xs text-muted-foreground">{target}</span>}
      </div>
    </div>
  );
}
