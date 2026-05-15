import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import GenerateCodeForm from "./generate-code-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "keg_super_admin", "operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: codes } = await admin
    .from("referral_codes")
    .select("id, code, owner_user_id, reward_krw, discount_pct, use_count, enabled, expires_at, created_at, profiles!referral_codes_owner_user_id_fkey(email, name)")
    .order("created_at", { ascending: false });

  const totalUses = (codes ?? []).reduce((s, c) => s + c.use_count, 0);
  const totalRewardKrw = (codes ?? []).reduce((s, c) => s + c.use_count * c.reward_krw, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W21 · EXPAND</span>
        <h1 className="mt-1 text-3xl font-bold">추천 인센티브</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          학생·강사가 추천 코드 공유 → 신규 학생 가입 → 추천인에게 보상. 학생 1,000명 확장 채널.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="활성 코드" value={(codes ?? []).filter((c) => c.enabled).length.toString()} />
        <Stat label="누적 사용" value={totalUses.toString()} />
        <Stat label="누적 보상" value={`₩${totalRewardKrw.toLocaleString()}`} />
      </div>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 코드 발급</h2>
        <GenerateCodeForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3">
          <h2 className="font-semibold">발급된 코드 ({codes?.length ?? 0})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left">코드</th>
              <th className="px-4 py-2 text-left">소유자</th>
              <th className="px-4 py-2 text-right">사용</th>
              <th className="px-4 py-2 text-right">보상/건</th>
              <th className="px-4 py-2 text-right">할인%</th>
              <th className="px-4 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {(codes ?? []).map((c) => {
              const p = Array.isArray(c.profiles) ? c.profiles[0] : (c.profiles as { name?: string; email?: string } | null);
              return (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-mono text-sm font-semibold">{c.code}</td>
                  <td className="px-4 py-2 text-xs">{p?.name ?? p?.email ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.use_count}</td>
                  <td className="px-4 py-2 text-right font-mono">₩{c.reward_krw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.discount_pct}%</td>
                  <td className="px-4 py-2 text-xs">
                    {c.enabled ? <span className="text-emerald-600">활성</span> : <span className="text-zinc-500">비활성</span>}
                  </td>
                </tr>
              );
            })}
            {(!codes || codes.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">발급된 코드가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
