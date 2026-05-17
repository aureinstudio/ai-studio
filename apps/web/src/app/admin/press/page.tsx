import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewPressForm from "./new-press-form";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  press_release: "보도자료",
  interview: "인터뷰",
  article: "기사",
  conference_talk: "발표",
  podcast: "팟캐스트",
  case_study: "케이스 스터디",
};

const SENTIMENT_CLS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-zinc-100 text-zinc-700",
  negative: "bg-red-100 text-red-700",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: mentions } = await admin
    .from("press_mentions")
    .select("*")
    .order("published_date", { ascending: false, nullsFirst: false });

  const totalReach = (mentions ?? []).reduce((s, m) => s + Number(m.reach_estimate ?? 0), 0);
  const positive = (mentions ?? []).filter((m) => m.sentiment === "positive").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W33 · PR</span>
        <h1 className="mt-1 text-3xl font-bold">언론·발표 추적</h1>
        <p className="mt-1 text-sm text-muted-foreground">보도자료·인터뷰·컨퍼런스 발표·팟캐스트 통합 관리.</p>
      </header>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="전체 언급" value={(mentions ?? []).length.toString()} />
        <Stat label="긍정 비율" value={`${(mentions ?? []).length > 0 ? Math.round((positive / mentions!.length) * 100) : 0}%`} cls="text-emerald-600" />
        <Stat label="누적 도달" value={totalReach.toLocaleString()} sub="추정값" />
      </div>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 언급 추가</h2>
        <NewPressForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">언급 ({mentions?.length ?? 0})</h2></div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">날짜</th>
              <th className="px-3 py-2 text-left">유형</th>
              <th className="px-3 py-2 text-left">매체</th>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">평가</th>
              <th className="px-3 py-2 text-right">도달</th>
            </tr>
          </thead>
          <tbody>
            {(mentions ?? []).map((m) => (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-xs">{m.published_date ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{TYPE_LABEL[m.mention_type] ?? m.mention_type}</td>
                <td className="px-3 py-2">{m.outlet}</td>
                <td className="px-3 py-2">
                  {m.url ? <a href={m.url} target="_blank" rel="noopener" className="hover:underline">{m.title}</a> : m.title}
                </td>
                <td className="px-3 py-2">
                  {m.sentiment && <span className={`rounded px-1.5 py-0.5 text-xs ${SENTIMENT_CLS[m.sentiment]}`}>{m.sentiment}</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{m.reach_estimate?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
            {(!mentions || mentions.length === 0) && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">아직 언급 없음.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls ?? ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
