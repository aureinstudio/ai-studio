import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewLeadForm from "./new-lead-form";
import StageSelect from "./stage-select";

export const dynamic = "force-dynamic";

const STAGES = ["lead", "qualified", "demo", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  lead: "리드", qualified: "Qualified", demo: "데모", proposal: "제안서",
  negotiation: "협상", closed_won: "수주 ✓", closed_lost: "실주",
};
const STAGE_CLS: Record<string, string> = {
  lead: "bg-zinc-100 border-zinc-300",
  qualified: "bg-blue-50 border-blue-300",
  demo: "bg-purple-50 border-purple-300",
  proposal: "bg-amber-50 border-amber-300",
  negotiation: "bg-orange-50 border-orange-300",
  closed_won: "bg-emerald-50 border-emerald-300",
  closed_lost: "bg-red-50 border-red-300",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "keg_super_admin", "operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: leads } = await admin
    .from("sales_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  const byStage = (leads ?? []).reduce<Record<string, typeof leads>>((acc, l) => {
    (acc[l.stage] ??= []).push(l);
    return acc;
  }, {});

  const totalArr = (leads ?? []).reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);
  const wonArr = (leads ?? []).filter((l) => l.stage === "closed_won").reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);
  const pipelineArr = (leads ?? []).filter((l) => !["closed_won", "closed_lost"].includes(l.stage)).reduce((s, l) => s + Number(l.estimated_arr_krw ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W26 · B2B SALES</span>
        <h1 className="mt-1 text-3xl font-bold">영업 파이프라인</h1>
        <p className="mt-2 text-sm text-muted-foreground">B2B 5개사 도달 목표 · MRR $7,500+ 트래킹.</p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="전체 리드" value={(leads?.length ?? 0).toString()} />
        <Stat label="파이프라인 ARR" value={`₩${(pipelineArr / 1_0000_0000).toFixed(1)}억`} cls="text-blue-600" />
        <Stat label="수주 ARR" value={`₩${(wonArr / 1_0000_0000).toFixed(1)}억`} cls="text-emerald-600" sub={`${(leads ?? []).filter((l) => l.stage === "closed_won").length}개사`} />
      </div>

      <section className="mb-6 rounded-lg border bg-card p-4">
        <NewLeadForm />
      </section>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "1400px" }}>
          {STAGES.map((stage) => (
            <div key={stage} className={`flex-1 rounded-lg border-2 p-3 ${STAGE_CLS[stage]}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-sm">{STAGE_LABEL[stage]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-mono">{(byStage[stage] ?? []).length}</span>
              </div>
              <div className="space-y-2">
                {(byStage[stage] ?? []).map((l) => (
                  <div key={l.id} className="rounded-md border bg-white p-2 text-xs">
                    <div className="font-semibold">{l.company_name}</div>
                    {l.contact_name && <div className="text-muted-foreground">{l.contact_name}</div>}
                    {l.estimated_arr_krw && (
                      <div className="mt-1 font-mono text-emerald-700">₩{(Number(l.estimated_arr_krw) / 1_0000_000).toFixed(1)}M ARR</div>
                    )}
                    {l.next_action && (
                      <div className="mt-1 text-[10px] text-muted-foreground">→ {l.next_action}</div>
                    )}
                    <div className="mt-2"><StageSelect id={l.id} currentStage={l.stage} /></div>
                  </div>
                ))}
                {(!byStage[stage] || byStage[stage].length === 0) && (
                  <div className="rounded-md border-2 border-dashed py-4 text-center text-xs text-muted-foreground">비어 있음</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
