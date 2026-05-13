import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CreateKeyForm from "./create-key-form";
import RevokeButton from "./revoke-button";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: keys }, { data: users }] = await Promise.all([
    admin
      .from("api_keys")
      .select("id, owner_user_id, name, key_prefix, scopes, rate_limit_per_min, monthly_cost_cap_usd, last_used_at, revoked_at, created_at")
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email, role").in("role", ["customer", "admin"]).order("email"),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">API 키 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          외부 시스템·B2B 고객사가 ai-studio를 호출할 수 있는 키를 발급·취소합니다.
          평문 키는 발급 직후 1회만 표시됩니다.
        </p>
      </div>

      <section className="mb-10 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">새 키 발급</h2>
        <CreateKeyForm users={(users ?? []).map((u) => ({ id: u.id, email: u.email, role: u.role }))} />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3">
          <h2 className="text-lg font-semibold">발급된 키 ({keys?.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {(keys ?? []).map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  {k.revoked_at ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">취소됨</span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">활성</span>
                  )}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {k.key_prefix}…  ·  {(k.scopes as string[]).join(", ")}  ·  {k.rate_limit_per_min}/min  ·  cap ${k.monthly_cost_cap_usd}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  소유자: {k.owner_user_id.slice(0, 8)}… · 최근 사용: {k.last_used_at ? new Date(k.last_used_at).toLocaleString("ko-KR") : "—"}
                </div>
              </div>
              {!k.revoked_at && <RevokeButton id={k.id} />}
            </div>
          ))}
          {(!keys || keys.length === 0) && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">발급된 키가 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}
