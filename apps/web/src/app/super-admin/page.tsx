import Link from "next/link";
import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CreateTenantForm from "./create-tenant-form";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-blue-100 text-blue-700",
  suspended: "bg-amber-100 text-amber-700",
  archived: "bg-zinc-200 text-zinc-700",
};

const PLAN_CLS: Record<string, string> = {
  enterprise: "bg-purple-100 text-purple-700",
  pro: "bg-blue-100 text-blue-700",
  starter: "bg-zinc-100 text-zinc-700",
  free: "bg-zinc-100 text-zinc-600",
};

export default async function Page() {
  const isSuper = await isKegSuperAdmin();
  if (!isSuper) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, slug, tenant_type, plan, status, max_students, max_courses, contract_start, contract_end, created_at")
    .order("created_at", { ascending: false });

  // 테넌트별 사용자 / 작업 카운트
  const stats = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const [{ count: users }, { count: studioJobs }, { count: castJobs }] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("studio_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("cast_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      return { tenant: t, users: users ?? 0, studio_jobs: studioJobs ?? 0, cast_jobs: castJobs ?? 0 };
    }),
  );

  const totalTenants = tenants?.length ?? 0;
  const activeTenants = (tenants ?? []).filter((t) => t.status === "active").length;
  const totalUsers = stats.reduce((s, r) => s + r.users, 0);
  const totalJobs = stats.reduce((s, r) => s + r.studio_jobs + r.cast_jobs, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-purple-100 px-2 py-0.5 font-semibold text-purple-700">KEG SUPER ADMIN</span>
          <span className="text-muted-foreground">Phase 4 · Multi-tenant 통합 관리</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">통합 슈퍼 어드민</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          모든 테넌트의 통합 KPI · 사용자 · 작업을 조회하고 신규 테넌트를 생성합니다.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="전체 테넌트" value={totalTenants.toString()} />
        <Stat label="활성" value={activeTenants.toString()} cls="text-emerald-600" />
        <Stat label="누적 사용자" value={totalUsers.toLocaleString()} />
        <Stat label="누적 작업" value={totalJobs.toLocaleString()} />
      </div>

      <section className="mb-10 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 테넌트 생성</h2>
        <CreateTenantForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <h2 className="font-semibold">테넌트 목록</h2>
          <span className="text-xs text-muted-foreground">{totalTenants}개</span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left">이름 / slug</th>
              <th className="px-4 py-2 text-left">유형 / 플랜</th>
              <th className="px-4 py-2 text-left">상태</th>
              <th className="px-4 py-2 text-right">사용자</th>
              <th className="px-4 py-2 text-right">Studio</th>
              <th className="px-4 py-2 text-right">Cast</th>
              <th className="px-4 py-2 text-left">계약 만료</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ tenant: t, users, studio_jobs, cast_jobs }) => (
              <tr key={t.id} className="border-b last:border-b-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{t.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{t.slug}</div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-xs">{t.tenant_type}</div>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${PLAN_CLS[t.plan]}`}>{t.plan}</span>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[t.status]}`}>{t.status}</span>
                </td>
                <td className="px-4 py-2 text-right font-mono">{users.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{studio_jobs.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{cast_jobs.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {t.contract_end ? new Date(t.contract_end).toLocaleDateString("ko-KR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Phase 4 · 서브도메인 라우팅(*.ai-studio.kr)은 별도 DNS 설정 필요 — 현재는 같은 도메인 + RLS 격리로 동작.
      </p>

      <div className="mt-4">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">← 일반 관리자 페이지로</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls ?? ""}`}>{value}</div>
    </div>
  );
}
