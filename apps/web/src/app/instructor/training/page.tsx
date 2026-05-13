import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ModuleCheckbox from "./module-checkbox";

export const dynamic = "force-dynamic";

const MODULES = [
  { key: "m1_understand", title: "모듈 1 · ai-studio 이해", hours: 1, summary: "전체 구조·3 솔루션(Studio/Cast/Tutor)·KPI 이해." },
  { key: "m2_studio", title: "모듈 2 · Studio 활용", hours: 2, summary: "콘텐츠 생성 흐름·어댑터(5 카테고리)·검토 워크플로우." },
  { key: "m3_tutor", title: "모듈 3 · Tutor 모니터링", hours: 2, summary: "이해도 알림·OFF_TOPIC·환각 차단·개입 시점." },
  { key: "m4_care", title: "모듈 4 · 학생 케어", hours: 2, summary: "위험 학생 조기 식별·care_messages·intervention 절차." },
  { key: "m5_review", title: "모듈 5 · 콘텐츠 검토", hours: 1, summary: "3축 평가(정확성·완성도·교수법)·SME 협업." },
] as const;

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/training");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: progress } = await admin
    .from("instructor_training_progress")
    .select("module_key, completed_at")
    .eq("instructor_id", user.id);

  const done = new Map((progress ?? []).map((p) => [p.module_key, p.completed_at]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">강사 교육 프로그램</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        8시간 정규 과정. 각 모듈 완료 후 체크하면 본인 KPI에 자동 반영됩니다.
        강사 본인도 학생 등록 후 직접 ai-studio를 체험해보는 것을 권장합니다 — 자체 학습 기회.
      </p>

      <div className="mt-8 space-y-3">
        {MODULES.map((m) => {
          const completed = done.has(m.key);
          return (
            <div key={m.key} className={`rounded-lg border p-4 ${completed ? "bg-emerald-50/30 border-emerald-300" : "bg-card"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{m.title}</h2>
                    <span className="text-xs text-muted-foreground">({m.hours}h)</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
                  {completed && (
                    <p className="mt-1 text-xs text-emerald-700">
                      ✓ 완료 — {new Date(done.get(m.key)!).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
                <ModuleCheckbox moduleKey={m.key} completed={completed} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border bg-muted/30 p-4 text-sm">
        <h3 className="mb-2 font-semibold">참고 자료</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>운영 매뉴얼: <a href="/admin/runbook" className="text-blue-600 hover:underline">/admin/runbook</a></li>
          <li>5 역할별 교육 매트릭스: <a href="/admin/training-program" className="text-blue-600 hover:underline">/admin/training-program</a></li>
          <li>커뮤니티 베스트 프랙티스: <a href="/instructors/community?category=best_practice" className="text-blue-600 hover:underline">/instructors/community</a></li>
        </ul>
      </div>
    </div>
  );
}
