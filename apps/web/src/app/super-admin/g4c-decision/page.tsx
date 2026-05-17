import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DecisionForm from "./decision-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: lastDecision } = await admin
    .from("g4c_decisions")
    .select("decision, rationale, next_actions, board_meeting_date, spinoff_consideration, decided_at")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-purple-700">GATE G4-C</span>
        <h1 className="mt-1 text-3xl font-bold">Phase 4 → Phase 5 의사결정</h1>
        <p className="mt-1 text-sm text-muted-foreground">이사회 승인 사항을 기록합니다.</p>
      </header>

      {lastDecision && (
        <section className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <div className="text-xs font-bold text-emerald-900">최근 결정 · {new Date(lastDecision.decided_at).toLocaleString("ko-KR")}</div>
          <div className="mt-1 text-lg font-bold uppercase">{lastDecision.decision}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lastDecision.rationale}</p>
          {lastDecision.next_actions && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">다음 액션</summary>
              <pre className="mt-1 whitespace-pre-wrap text-xs">{lastDecision.next_actions}</pre>
            </details>
          )}
          {lastDecision.board_meeting_date && (
            <div className="mt-2 text-xs">이사회 일자: {lastDecision.board_meeting_date}</div>
          )}
        </section>
      )}

      <DecisionForm />
    </div>
  );
}
