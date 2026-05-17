import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DOMAIN_CLS: Record<string, string> = {
  b2c: "bg-blue-100 text-blue-700",
  b2b: "bg-purple-100 text-purple-700",
  global: "bg-rose-100 text-rose-700",
  infra: "bg-zinc-100 text-zinc-700",
  org: "bg-amber-100 text-amber-700",
  other: "bg-emerald-100 text-emerald-700",
};

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: roadmap } = await admin
    .from("phase5_roadmap")
    .select("*")
    .order("week_label")
    .order("created_at");

  const byQuarter = (roadmap ?? []).reduce<Record<string, typeof roadmap>>((acc, r) => {
    (acc[r.week_label] ??= []).push(r);
    return acc;
  }, {});

  const totalCost = (roadmap ?? []).reduce((s, r) => s + Number(r.estimated_cost_krw ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-700">PHASE 5 PREP</span>
        <h1 className="mt-1 text-3xl font-bold">Phase 5 (차년도) 로드맵 초안</h1>
        <p className="mt-1 text-sm text-muted-foreground">24주 분기별 이니셔티브 + 비용 추정.</p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="전체 이니셔티브" value={(roadmap ?? []).length.toString()} />
        <Stat label="예상 총 투자" value={`₩${(totalCost / 1_0000_0000).toFixed(1)}억`} />
        <Stat label="완료" value={(roadmap ?? []).filter((r) => r.status === "done").length.toString()} cls="text-emerald-600" />
      </div>

      <div className="space-y-6">
        {Object.entries(byQuarter).sort(([a], [b]) => a.localeCompare(b)).map(([q, items]) => {
          const qCost = (items ?? []).reduce((s, i) => s + Number(i.estimated_cost_krw ?? 0), 0);
          return (
            <section key={q} className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{q}</h2>
                <span className="font-mono text-sm">₩{(qCost / 1_0000_000).toFixed(0)}M</span>
              </div>
              <ul className="space-y-2">
                {(items ?? []).map((r) => (
                  <li key={r.id} className="flex items-start gap-3 rounded-md border bg-background p-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${DOMAIN_CLS[r.domain ?? "other"]}`}>{r.domain}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.initiative}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.owner_team} · 예상 ₩{(Number(r.estimated_cost_krw ?? 0) / 1_0000_000).toFixed(0)}M
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        세부 수정은 SQL Editor에서 phase5_roadmap row 직접 update. 사업 계획서: <a className="text-blue-600 hover:underline" href="/super-admin/annual-plan">/super-admin/annual-plan</a>
      </p>
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
