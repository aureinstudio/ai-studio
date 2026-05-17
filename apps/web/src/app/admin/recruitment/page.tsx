import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewHireForm from "./new-hire-form";
import HireStageSelect from "./hire-stage-select";

export const dynamic = "force-dynamic";

const STAGES = ["sourcing","screening","interview","offer","onboarded","rejected","withdrew"] as const;
const STAGE_LABEL: Record<string, string> = {
  sourcing: "소싱", screening: "서류", interview: "면접", offer: "오퍼", onboarded: "입사 ✓", rejected: "탈락", withdrew: "사퇴",
};
const STAGE_CLS: Record<string, string> = {
  sourcing: "bg-zinc-50 border-zinc-300",
  screening: "bg-blue-50 border-blue-300",
  interview: "bg-purple-50 border-purple-300",
  offer: "bg-amber-50 border-amber-300",
  onboarded: "bg-emerald-50 border-emerald-300",
  rejected: "bg-red-50 border-red-300",
  withdrew: "bg-zinc-50 border-zinc-400",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: hires }, { data: depts }] = await Promise.all([
    admin.from("hires").select("*").order("updated_at", { ascending: false }),
    admin.from("departments").select("id, name, slug, team_type").neq("team_type", "division"),
  ]);

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));

  const byStage = (hires ?? []).reduce<Record<string, typeof hires>>((acc, h) => {
    (acc[h.stage] ??= []).push(h);
    return acc;
  }, {});

  const open = (hires ?? []).filter((h) => !["onboarded","rejected","withdrew"].includes(h.stage)).length;
  const hired = (hires ?? []).filter((h) => h.stage === "onboarded").length;

  return (
    <div className="mx-auto max-w-[1700px] px-6 py-10">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W31 · 채용</span>
        <h1 className="mt-1 text-3xl font-bold">채용 파이프라인</h1>
        <p className="mt-1 text-sm text-muted-foreground">영업·CSM·DevOps·디자이너 — 4명 영입 + 강사 등 추가 채용 통합 추적.</p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="진행 중" value={open.toString()} />
        <Stat label="입사 완료" value={hired.toString()} cls="text-emerald-600" />
        <Stat label="전체" value={(hires ?? []).length.toString()} />
      </div>

      <section className="mb-6 rounded-lg border bg-card p-4">
        <NewHireForm departments={(depts ?? []).map((d) => ({ id: d.id, name: d.name }))} />
      </section>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "1500px" }}>
          {STAGES.map((stage) => (
            <div key={stage} className={`flex-1 rounded-lg border-2 p-3 ${STAGE_CLS[stage]}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-sm">{STAGE_LABEL[stage]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-mono">{(byStage[stage] ?? []).length}</span>
              </div>
              <div className="space-y-2">
                {(byStage[stage] ?? []).map((h) => (
                  <div key={h.id} className="rounded-md border bg-white p-2 text-xs">
                    <div className="font-semibold">{h.candidate_name}</div>
                    <div className="text-muted-foreground">{h.role}</div>
                    {h.target_department_id && (
                      <div className="text-[10px] text-blue-600">{deptMap.get(h.target_department_id) ?? "—"}</div>
                    )}
                    {h.expected_salary_krw && (
                      <div className="mt-1 font-mono text-[10px]">예상 ₩{(Number(h.expected_salary_krw) / 1_0000_000).toFixed(1)}M</div>
                    )}
                    <div className="mt-2"><HireStageSelect id={h.id} currentStage={h.stage} /></div>
                  </div>
                ))}
                {(!byStage[stage] || byStage[stage].length === 0) && (
                  <div className="rounded-md border-2 border-dashed py-3 text-center text-xs text-muted-foreground">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
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
