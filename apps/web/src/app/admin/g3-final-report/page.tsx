import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">G3 종합 보고서</h1>
      <p className="mt-2 text-sm text-muted-foreground">14주 누적 KPI · 5 가설 · 5 카테고리 ROI · 본부장 의존도 · 인시던트 · 자유 서술 일괄 집계.</p>

      <div className="mt-6 space-y-3">
        <Link
          href="/api/admin/g3-final-report"
          target="_blank"
          className="block rounded-md border bg-card p-4 hover:bg-muted"
        >
          <div className="font-semibold">JSON 보기 (DRY RUN)</div>
          <div className="mt-1 text-xs text-muted-foreground">현재 데이터로 보고서 즉시 생성 (저장 안 됨)</div>
        </Link>
        <Link
          href="/api/admin/g3-final-report?save=1"
          target="_blank"
          className="block rounded-md border bg-foreground p-4 text-background hover:opacity-90"
        >
          <div className="font-semibold">JSON 생성 + 영구 저장</div>
          <div className="mt-1 text-xs opacity-80">g3_reports에 스냅샷 저장 → 추후 비교용</div>
        </Link>
      </div>

      <div className="mt-8 rounded-md border bg-muted/30 p-4 text-xs">
        <h3 className="mb-2 font-semibold">사용 권장 순서</h3>
        <ol className="list-decimal space-y-1 pl-6">
          <li>먼저 JSON 보기로 데이터 점검</li>
          <li>이상 없으면 영구 저장 (스냅샷)</li>
          <li>/admin/g3-decision에서 4 옵션 중 선택</li>
          <li>결정 후 phase4_plans에 사업 계획 초안 자동 생성됨</li>
        </ol>
      </div>
    </div>
  );
}
