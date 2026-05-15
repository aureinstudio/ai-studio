import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CampaignForm from "./campaign-form";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  naver_search: "네이버 검색",
  google_search: "구글 검색",
  kakao_ads: "카카오 광고",
  facebook_ads: "페이스북",
  instagram: "인스타그램",
  influencer: "인플루언서",
  keg_offline: "KEG 학원 오프라인",
  organic: "유기적",
  other: "기타",
};

const STATUS_CLS: Record<string, string> = {
  planned: "bg-zinc-100 text-zinc-700",
  running: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "keg_super_admin", "operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: campaigns } = await admin
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const totals = (campaigns ?? []).reduce((acc, c) => {
    acc.budget += Number(c.budget_krw ?? 0);
    acc.spend += Number(c.spend_krw ?? 0);
    acc.impressions += Number(c.impressions ?? 0);
    acc.clicks += Number(c.clicks ?? 0);
    acc.signups += Number(c.signups ?? 0);
    acc.paid += Number(c.paid_conversions ?? 0);
    return acc;
  }, { budget: 0, spend: 0, impressions: 0, clicks: 0, signups: 0, paid: 0 });

  const cac = totals.paid > 0 ? Math.round(totals.spend / totals.paid) : 0;
  const cvr = totals.clicks > 0 ? ((totals.signups / totals.clicks) * 100).toFixed(2) : "0";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W25 · MARKETING</span>
        <h1 className="mt-1 text-3xl font-bold">마케팅 캠페인</h1>
        <p className="mt-2 text-sm text-muted-foreground">학생 800~1,000명 확장 — 채널별 비용·전환·CAC 통합 추적.</p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-6">
        <Stat label="총 예산" value={`₩${(totals.budget / 1_0000).toFixed(0)}만`} />
        <Stat label="집행" value={`₩${(totals.spend / 1_0000).toFixed(0)}만`} />
        <Stat label="노출" value={totals.impressions.toLocaleString()} />
        <Stat label="클릭" value={totals.clicks.toLocaleString()} />
        <Stat label="가입" value={totals.signups.toLocaleString()} sub={`전환 ${cvr}%`} />
        <Stat label="CAC" value={`₩${cac.toLocaleString()}`} sub={`결제 ${totals.paid}건`} cls="text-amber-700" />
      </div>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 캠페인</h2>
        <CampaignForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">캠페인 목록 ({campaigns?.length ?? 0})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-right">예산/집행</th>
                <th className="px-3 py-2 text-right">노출</th>
                <th className="px-3 py-2 text-right">클릭</th>
                <th className="px-3 py-2 text-right">가입</th>
                <th className="px-3 py-2 text-right">결제</th>
                <th className="px-3 py-2 text-right">CAC</th>
              </tr>
            </thead>
            <tbody>
              {(campaigns ?? []).map((c) => {
                const cacOne = c.paid_conversions > 0 ? Math.round(Number(c.spend_krw) / c.paid_conversions) : 0;
                return (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-xs">{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLS[c.status]}`}>{c.status}</span></td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      ₩{(Number(c.spend_krw) / 1_0000).toFixed(0)}/{(Number(c.budget_krw) / 1_0000).toFixed(0)}만
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{c.impressions.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{c.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{c.signups}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{c.paid_conversions}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{cacOne > 0 ? `₩${cacOne.toLocaleString()}` : "—"}</td>
                  </tr>
                );
              })}
              {(!campaigns || campaigns.length === 0) && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">캠페인 없음.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls ?? ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
