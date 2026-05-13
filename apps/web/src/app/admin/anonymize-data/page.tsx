import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RunAnonymizeButton from "./run-anonymize-button";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [
    { count: totalStudents },
    { data: choices },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    admin.from("beta_end_data_choices").select("choice"),
  ]);

  const counts = { convert_paid: 0, delete_all: 0, anonymize_only: 0 };
  for (const c of choices ?? []) counts[c.choice as keyof typeof counts] += 1;
  const responded = (choices ?? []).length;
  const pending = (totalStudents ?? 0) - responded;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">학생 데이터 처리 — 베타 종료</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          학생이 선택한 옵션에 따라 데이터 삭제·익명화·정식 전환을 일괄 처리합니다.
          베타 종료 후 1개월 이내 완료 필수 (개인정보 보호).
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">학생 선택 현황</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="전체 학생" value={(totalStudents ?? 0).toString()} />
          <Stat label="정식 전환" value={counts.convert_paid.toString()} cls="text-emerald-700" />
          <Stat label="익명화만" value={counts.anonymize_only.toString()} cls="text-blue-700" />
          <Stat label="완전 삭제" value={counts.delete_all.toString()} cls="text-red-700" />
        </div>
        <div className="mt-4 text-sm">
          <span className="text-muted-foreground">미응답: </span>
          <b>{pending}명</b>
          {pending > 0 && <span className="ml-2 text-xs text-amber-700">(기본 정책: anonymize_only 처리)</span>}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">익명화 처리 절차</h2>
        <ol className="list-decimal space-y-2 pl-6 text-sm">
          <li><b>convert_paid:</b> 변경 없음 — 정식 서비스로 이전 (별도 마이그레이션)</li>
          <li><b>anonymize_only:</b> 이메일·이름 해시, 대화 본문 PII 제거, 학습 통계는 유지</li>
          <li><b>delete_all:</b> 모든 데이터 영구 삭제 (audit_log만 GDPR-compliance 유지)</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          이 작업은 되돌릴 수 없습니다. 시뮬레이션은 DRY RUN 모드로 미리 확인하세요.
        </p>
        <div className="mt-4">
          <RunAnonymizeButton />
        </div>
      </section>

      <section className="rounded-lg border bg-amber-50 p-6">
        <h2 className="mb-2 font-semibold text-amber-900">학술/B2B 자료 활용</h2>
        <p className="text-sm">
          익명화된 데이터(학습 패턴·튜터 대화 PII 제거본·평가 결과)는 다음 용도로 사용 가능:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
          <li>외부 연구·논문 (한국어 교육 AI 케이스 스터디)</li>
          <li>B2B 영업 자료 (실증 KPI)</li>
          <li>Aurein·KEG 내부 학습 자료</li>
          <li>차년도 모델 학습 데이터 (RAG corpus)</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls ?? ""}`}>{value}</div>
    </div>
  );
}
