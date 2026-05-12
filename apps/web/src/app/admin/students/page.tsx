import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Profile = { id: string; role: string; email: string; name: string | null };

type AlertRow = {
  id: string;
  alert_type: string;
  severity: "low" | "medium" | "high";
  student_id: string;
  evidence: { items?: string[] } | null;
  recommended_intervention: string | null;
  alert_target: string;
  dropout_risk_score: number | null;
  acknowledged_at: string | null;
  created_at: string;
};

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/students");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">접근 불가</h1>
        <p className="mt-3 text-sm text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  // 활성 알림 (acknowledged 없는)
  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("*")
    .is("acknowledged_at", null)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<AlertRow[]>();

  // 학생 정보 (간단 매핑)
  const studentIds = [...new Set((alerts ?? []).map((a) => a.student_id))];
  const { data: students } = await supabase
    .from("profiles")
    .select("id, email, name, role")
    .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<Profile[]>();
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  // 심각도별 카운트
  const counts = {
    high: (alerts ?? []).filter((a) => a.severity === "high").length,
    medium: (alerts ?? []).filter((a) => a.severity === "medium").length,
    low: (alerts ?? []).filter((a) => a.severity === "low").length,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Admin · Students
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          학생 위험 대시보드
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          #09 안전 감지가 생성한 미처리 알림 목록. acknowledge 시 목록에서 사라집니다.
        </p>
      </div>

      {/* 심각도별 카운트 */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              High (즉시 개입)
            </p>
            <p className="font-mono text-3xl font-semibold text-red-300">{counts.high}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Medium (주의)
            </p>
            <p className="font-mono text-3xl font-semibold text-amber-300">{counts.medium}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Low (모니터링)
            </p>
            <p className="font-mono text-3xl font-semibold text-muted-foreground">
              {counts.low}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 알림 목록 */}
      {(alerts ?? []).length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            ✓ 미처리 알림이 없습니다. 모든 학생이 안전 상태입니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(alerts ?? []).map((a) => {
            const student = studentMap.get(a.student_id);
            return (
              <Card
                key={a.id}
                className={`${
                  a.severity === "high"
                    ? "border-red-500/40 bg-red-500/5"
                    : a.severity === "medium"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border/60 bg-card/80"
                }`}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                            a.severity === "high"
                              ? "bg-red-500/20 text-red-300"
                              : a.severity === "medium"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-muted-foreground/10 text-muted-foreground"
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="font-mono text-xs text-foreground">
                          {a.alert_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          → {a.alert_target}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {student?.email ?? a.student_id.slice(0, 8)}
                        {student?.name && (
                          <span className="ml-2 text-muted-foreground">
                            ({student.name})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      {a.dropout_risk_score !== null && (
                        <p className="font-mono text-xs text-muted-foreground">
                          이탈 위험: {a.dropout_risk_score}/100
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>

                  {a.evidence?.items && a.evidence.items.length > 0 && (
                    <div className="mb-2 rounded-md border border-border/40 bg-background/40 p-2">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        근거
                      </p>
                      <ul className="space-y-0.5">
                        {a.evidence.items.slice(0, 3).map((e, i) => (
                          <li key={i} className="text-xs text-foreground/80">
                            • {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {a.recommended_intervention && (
                    <p className="text-xs text-foreground/90">
                      <span className="font-medium text-foreground">권장 조치: </span>
                      {a.recommended_intervention}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Link
                      href={`/admin#student-${a.student_id}`}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      학생 상세 보기 →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
