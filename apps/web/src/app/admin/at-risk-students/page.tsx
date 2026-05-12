import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AtRiskActions from "./actions";

export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  alert_type: string;
  severity: "low" | "medium" | "high";
  student_id: string;
  source_conversation_id: string | null;
  evidence: { items?: string[]; trend?: string; first_detected?: string } | null;
  recommended_intervention: string | null;
  dropout_risk_score: number | null;
  acknowledged_at: string | null;
  created_at: string;
};

type Aggregated = {
  student_id: string;
  email: string | null;
  name: string | null;
  last_seen_at: string | null;
  alerts: AlertRow[];
  max_severity: "low" | "medium" | "high";
  max_dropout_risk: number;
  priority_reasons: string[];
};

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3 } as const;

export default async function AtRiskStudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/at-risk-students");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const stale7d = new Date(Date.now() - 7 * 86400_000).toISOString();

  // 1) 최근 14일 미확인 알림
  const { data: alerts } = await admin
    .from("admin_alerts")
    .select("id, alert_type, severity, student_id, source_conversation_id, evidence, recommended_intervention, dropout_risk_score, acknowledged_at, created_at")
    .is("acknowledged_at", null)
    .gte("created_at", new Date(Date.now() - 14 * 86400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(300);

  // 2) 학생별 집계
  const byStudent = new Map<string, Aggregated>();
  for (const a of (alerts ?? []) as AlertRow[]) {
    let agg = byStudent.get(a.student_id);
    if (!agg) {
      agg = {
        student_id: a.student_id,
        email: null,
        name: null,
        last_seen_at: null,
        alerts: [],
        max_severity: "low",
        max_dropout_risk: 0,
        priority_reasons: [],
      };
      byStudent.set(a.student_id, agg);
    }
    agg.alerts.push(a);
    if (SEVERITY_WEIGHT[a.severity] > SEVERITY_WEIGHT[agg.max_severity]) agg.max_severity = a.severity;
    if ((a.dropout_risk_score ?? 0) > agg.max_dropout_risk) agg.max_dropout_risk = a.dropout_risk_score ?? 0;
  }

  // 3) profile 조인 + 7일 미접속 자동 추가
  const ids = Array.from(byStudent.keys());
  if (ids.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, email, name, last_seen_at")
      .in("id", ids);
    for (const p of profs ?? []) {
      const agg = byStudent.get(p.id);
      if (!agg) continue;
      agg.email = p.email;
      agg.name = p.name;
      agg.last_seen_at = p.last_seen_at;
    }
  }

  // 별도 — 알림 없지만 7일 미접속자도 위험 후보로 추가
  const { data: stale } = await admin
    .from("profiles")
    .select("id, email, name, last_seen_at")
    .eq("role", "user")
    .lt("last_seen_at", stale7d)
    .not("last_seen_at", "is", null)
    .limit(200);
  for (const p of stale ?? []) {
    if (!byStudent.has(p.id)) {
      byStudent.set(p.id, {
        student_id: p.id,
        email: p.email,
        name: p.name,
        last_seen_at: p.last_seen_at,
        alerts: [],
        max_severity: "low",
        max_dropout_risk: 0,
        priority_reasons: ["7일+ 미접속"],
      });
    } else {
      byStudent.get(p.id)!.priority_reasons.push("7일+ 미접속");
    }
  }

  // 4) 우선순위 정렬 (severity → dropout_risk → 7일 미접속)
  const list = Array.from(byStudent.values()).sort((a, b) => {
    const sev = SEVERITY_WEIGHT[b.max_severity] - SEVERITY_WEIGHT[a.max_severity];
    if (sev !== 0) return sev;
    return b.max_dropout_risk - a.max_dropout_risk;
  });

  // 사유 채우기
  for (const s of list) {
    if (s.max_severity === "high") s.priority_reasons.unshift("⚠ high severity");
    if (s.alerts.some((a) => a.alert_type === "mental_health")) s.priority_reasons.unshift("🆘 mental_health");
    if (s.alerts.some((a) => a.alert_type === "frustration")) s.priority_reasons.unshift("😟 frustration");
    if ((s.max_dropout_risk ?? 0) >= 70) s.priority_reasons.unshift(`이탈위험 ${s.max_dropout_risk}`);
  }

  const counts = {
    total: list.length,
    high: list.filter((s) => s.max_severity === "high").length,
    medium: list.filter((s) => s.max_severity === "medium").length,
    inactive7d: list.filter((s) => s.priority_reasons.includes("7일+ 미접속")).length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">위험 학생 모니터</h1>
          <p className="mt-1 text-sm text-muted-foreground">우선순위순 정렬 — 최근 14일 미확인 알림 + 7일+ 미접속</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "총 위험 학생", value: counts.total, cls: "" },
          { label: "high 심각도", value: counts.high, cls: "text-red-600" },
          { label: "medium 심각도", value: counts.medium, cls: "text-amber-600" },
          { label: "7일+ 미접속", value: counts.inactive7d, cls: "text-zinc-500" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground">{c.label}</div>
              <div className={`mt-2 text-3xl font-bold ${c.cls}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="px-6 pt-6"><h2 className="text-lg font-semibold">학생 목록</h2></CardHeader>
        <CardContent className="px-0 pb-0">
          {list.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">위험 학생 없음. 👍</p>
          ) : (
            <ul className="divide-y">
              {list.slice(0, 100).map((s) => (
                <li key={s.student_id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          s.max_severity === "high" ? "bg-red-100 text-red-700" :
                          s.max_severity === "medium" ? "bg-amber-100 text-amber-700" :
                          "bg-zinc-100 text-zinc-700"
                        }`}>{s.max_severity}</span>
                        <span className="font-semibold">{s.name ?? "(이름 미설정)"}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s.email ?? s.student_id.slice(0,8)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {s.priority_reasons.slice(0, 5).map((r, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{r}</span>
                        ))}
                      </div>
                      {s.alerts.length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">알림 {s.alerts.length}건 보기</summary>
                          <ul className="mt-2 space-y-1 pl-4">
                            {s.alerts.slice(0, 5).map((a) => (
                              <li key={a.id}>
                                <span className="font-mono">{a.alert_type}</span> ·
                                <span className="ml-1">{a.severity}</span>
                                {a.recommended_intervention && (
                                  <div className="text-xs text-foreground mt-0.5">→ {a.recommended_intervention}</div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {s.last_seen_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          최근 접속: {new Date(s.last_seen_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <AtRiskActions
                      studentId={s.student_id}
                      studentEmail={s.email}
                      alertIds={s.alerts.map((a) => a.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
