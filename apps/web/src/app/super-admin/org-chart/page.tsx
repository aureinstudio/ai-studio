import { redirect } from "next/navigation";
import { isKegSuperAdmin } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const KPI_LABEL: Record<string, string> = {
  b2c: "학생 수 · NPS · LTV",
  b2b: "MRR · 고객사 수 · Churn",
  infra: "가동률 · 인시던트 · 비용",
};

const TARGET_HEADCOUNT: Record<string, number> = {
  b2c: 3, b2b: 4, infra: 3,
};

export default async function Page() {
  if (!(await isKegSuperAdmin())) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: depts } = await admin
    .from("departments")
    .select("id, name, slug, parent_id, team_type, description")
    .order("team_type");

  const division = (depts ?? []).find((d) => d.team_type === "division");
  const teams = (depts ?? []).filter((d) => d.parent_id === division?.id);

  // 팀별 멤버
  const memberCounts = await Promise.all(
    teams.map(async (t) => {
      const { count } = await admin
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("department_id", t.id)
        .is("left_at", null);
      return { dept_id: t.id, count: count ?? 0 };
    })
  );
  const memberMap = new Map(memberCounts.map((m) => [m.dept_id, m.count]));

  // 채용 중인 hires
  const { data: openHires } = await admin
    .from("hires")
    .select("id, candidate_name, role, target_department_id, stage")
    .not("stage", "in", '("onboarded","rejected","withdrew")');

  const hiresByDept = (openHires ?? []).reduce<Record<string, typeof openHires>>((acc, h) => {
    const key = h.target_department_id ?? "unassigned";
    (acc[key] ??= []).push(h);
    return acc;
  }, {});

  const totalMembers = memberCounts.reduce((s, m) => s + m.count, 0) + 1; // +1 사업부장
  const totalTarget = Object.values(TARGET_HEADCOUNT).reduce((a, b) => a + b, 0) + 1;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">W31 · ORG SPLIT</span>
        <h1 className="mt-1 text-3xl font-bold">조직도</h1>
        <p className="mt-1 text-sm text-muted-foreground">ai-studio 사업부 신설 — 11명 (사업부장 1 + B2C 3 + B2B 4 + Infra 3).</p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="현재 인원" value={totalMembers.toString()} target={`/ ${totalTarget}`} hit={totalMembers >= totalTarget} />
        <Stat label="채용 중" value={(openHires ?? []).length.toString()} sub="hires 파이프라인" />
        <Stat label="진척률" value={`${Math.round((totalMembers / totalTarget) * 100)}%`} />
      </div>

      {/* 사업부장 */}
      {division && (
        <div className="mb-4 rounded-lg border-2 border-purple-300 bg-purple-50 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-700">사업부</div>
          <div className="mt-1 text-xl font-bold">{division.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">{division.description}</p>
          <div className="mt-3 inline-block rounded bg-white px-3 py-1 text-sm">
            <b>사업부장</b> · 본부장 격상 (CEO 직속)
          </div>
        </div>
      )}

      {/* 3개 팀 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {teams.map((t) => {
          const memberCount = memberMap.get(t.id) ?? 0;
          const target = TARGET_HEADCOUNT[t.team_type ?? ""] ?? 0;
          const hires = hiresByDept[t.id] ?? [];
          return (
            <div key={t.id} className="rounded-lg border bg-card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">{t.team_type}</div>
              <h2 className="mt-1 text-lg font-bold">{t.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{memberCount}</span>
                <span className="text-xs text-muted-foreground">/ {target}명</span>
              </div>
              <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
                <div className="font-semibold">평가 KPI</div>
                <div className="text-muted-foreground">{KPI_LABEL[t.team_type ?? ""] ?? "—"}</div>
              </div>
              {hires.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs font-semibold">채용 중 ({hires.length})</div>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {hires.map((h) => (
                      <li key={h.id} className="flex justify-between">
                        <span>{h.role}</span>
                        <span className="rounded bg-zinc-100 px-1 text-[10px]">{h.stage}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-lg border bg-amber-50 p-4 text-sm">
        <h3 className="mb-2 font-semibold text-amber-900">⚠ 분리 운영 체크리스트</h3>
        <ul className="ml-4 list-disc space-y-1 text-xs text-amber-800">
          <li>예산·재무 분리 → <a className="underline" href="/super-admin/pnl">/super-admin/pnl</a></li>
          <li>채용 4건 진행 → <a className="underline" href="/admin/recruitment">/admin/recruitment</a></li>
          <li>본부장 → 사업부장 직책 변경 + CEO 직속 보고</li>
          <li>월간 P&L 자동 생성 (수동 입력 매월 1일)</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, target, sub, hit, cls }: { label: string; value: string; target?: string; sub?: string; hit?: boolean; cls?: string }) {
  const indCls = hit === true ? "text-emerald-600" : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${cls ?? ""} ${indCls}`}>{value}</span>
        {target && <span className="text-xs text-muted-foreground">{target}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
