import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RetroForm from "./retro-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/retrospective-final");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "operations", "sme", "instructor", "creator", "keg_super_admin"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("retrospective_final")
    .select("id, author_id, went_well, was_hard, do_differently, advice_for_successors, created_at, profiles!retrospective_final_author_id_fkey(name, role)")
    .order("created_at", { ascending: false });

  const { data: mine } = await admin
    .from("retrospective_final")
    .select("id")
    .eq("author_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">14주 종합 회고</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aurein·KEG 영구 자산화. 다른 본부장 후배에게 전할 조언 포함.
        </p>
      </header>

      {!mine && (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">내 회고 작성</h2>
          <RetroForm />
        </section>
      )}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3">
          <h2 className="font-semibold">TF 전체 회고 ({entries?.length ?? 0})</h2>
        </div>
        {(!entries || entries.length === 0) ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">아직 작성된 회고가 없습니다.</div>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const p = Array.isArray(e.profiles) ? e.profiles[0] : (e.profiles as { name?: string; role?: string } | null);
              return (
                <li key={e.id} className="px-6 py-5">
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="font-medium">{p?.name ?? "익명"}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5">{p?.role}</span>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Block title="✅ 잘 된 것" items={e.went_well ?? []} />
                    <Block title="⚠ 어려웠던 것" items={e.was_hard ?? []} />
                    <Block title="🔁 다음에 다르게 할 것" items={e.do_differently ?? []} />
                  </div>
                  {e.advice_for_successors && (
                    <div className="mt-4 rounded-md bg-muted/50 p-3">
                      <div className="mb-1 text-xs font-semibold">후배에게 전할 조언</div>
                      <p className="whitespace-pre-wrap text-sm">{e.advice_for_successors}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ol className="ml-4 list-decimal space-y-0.5 text-xs">
          {items.slice(0, 10).map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      )}
    </div>
  );
}
