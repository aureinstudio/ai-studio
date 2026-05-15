import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ApplicationRow from "./application-row";

export const dynamic = "force-dynamic";

type Application = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  course_interest: string | null;
  motivation: string | null;
  availability: string | null;
  status: "pending" | "approved" | "rejected" | "onboarded";
  reviewed_at: string | null;
  invite_sent_at: string | null;
  first_login_at: string | null;
  created_at: string;
};

export default async function BetaApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/beta-applications");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">접근 불가</h1>
      </div>
    );
  }

  const params = await searchParams;
  const filter = params.status ?? "all";

  const admin = createAdminClient();
  let q = admin.from("beta_applications").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter !== "all") q = q.eq("status", filter);
  const { data: apps } = await q;
  const list = (apps ?? []) as Application[];

  // 카운트
  const { data: counts } = await admin
    .from("beta_applications")
    .select("status");
  const byStatus: Record<string, number> = {};
  for (const r of counts ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">베타 신청 검토</h1>
          <p className="mt-1 text-sm text-muted-foreground">최신 200건 표시</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← 관리자 홈</Link>
      </header>

      {/* 필터 + 카운트 */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected", "onboarded"] as const).map((s) => {
          const n = s === "all" ? (counts?.length ?? 0) : (byStatus[s] ?? 0);
          const active = filter === s;
          return (
            <Link
              key={s}
              href={`/admin/beta-applications${s === "all" ? "" : `?status=${s}`}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                active ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"
              }`}
            >
              {s} <span className="ml-1 opacity-70">({n})</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">신청 목록</h2>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {list.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">표시할 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-6 py-3">상태</th>
                  <th className="py-3">이름 · 이메일</th>
                  <th className="py-3">과정</th>
                  <th className="py-3">시간대</th>
                  <th className="py-3 max-w-xs">동기</th>
                  <th className="py-3">신청일</th>
                  <th className="px-6 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <ApplicationRow key={a.id} a={a} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
