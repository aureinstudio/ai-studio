import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewCaseForm from "./new-case-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "keg_super_admin", "operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: cases } = await admin
    .from("case_studies")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W28 · CASE STUDIES</span>
        <h1 className="mt-1 text-3xl font-bold">성공 사례</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          B2B 영업 자료. 첫 2개사 케이스 정리 → 신규 영업에 활용.
        </p>
      </header>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">신규 사례 추가</h2>
        <NewCaseForm />
      </section>

      <section className="space-y-4">
        {(cases ?? []).map((cs) => (
          <article key={cs.id} className="rounded-lg border bg-card p-6">
            <div className="mb-2 flex items-center gap-2 text-xs">
              {cs.published ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">공개</span>
              ) : (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">초안</span>
              )}
              {cs.industry && <span className="text-muted-foreground">{cs.industry}</span>}
            </div>
            <h3 className="text-lg font-bold">{cs.headline}</h3>
            <p className="mt-1 text-sm font-semibold">{cs.customer_name}</p>
            {cs.problem && <p className="mt-3 text-sm"><b>문제:</b> {cs.problem}</p>}
            {cs.solution && <p className="mt-1 text-sm"><b>솔루션:</b> {cs.solution}</p>}
            {cs.testimonial && (
              <blockquote className="mt-3 border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm italic">
                "{cs.testimonial}"
                {cs.testimonial_author && <div className="mt-1 text-xs text-muted-foreground">— {cs.testimonial_author}</div>}
              </blockquote>
            )}
          </article>
        ))}
        {(!cases || cases.length === 0) && (
          <div className="rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            아직 등록된 사례가 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
