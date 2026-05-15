import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import UserRow from "./user-row";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin" | "sme" | "instructor" | "operations" | "creator";
  last_seen_at: string | null;
  created_at: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/users");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const params = await searchParams;
  let query = admin
    .from("profiles")
    .select("id, email, name, role, last_seen_at, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (params.q) query = query.ilike("email", `%${params.q}%`);
  if (params.role) query = query.eq("role", params.role);
  const { data: users } = await query;
  const rows = (users ?? []) as Profile[];

  // 카운트
  const { data: roleCounts } = await admin.from("profiles").select("role");
  const counts: Record<string, number> = {};
  for (const r of roleCounts ?? []) counts[r.role] = (counts[r.role] ?? 0) + 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">사용자 역할 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            6가지 역할 — 변경 시 즉시 적용. 본인 admin 강등은 차단.
          </p>
        </div>
        <Link href="/admin" className="text-sm hover:underline text-muted-foreground self-center">← 관리자</Link>
      </header>

      {/* 역할별 카운트 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className={`px-3 py-1.5 rounded text-sm ${!params.role ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}
        >
          전체 ({roleCounts?.length ?? 0})
        </Link>
        {(["admin", "operations", "instructor", "sme", "creator", "user"] as const).map((r) => (
          <Link
            key={r}
            href={`/admin/users?role=${r}`}
            className={`px-3 py-1.5 rounded text-sm ${params.role === r ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}
          >
            {r} ({counts[r] ?? 0})
          </Link>
        ))}
      </div>

      {/* 검색 */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="이메일 검색…"
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
        {params.role && <input type="hidden" name="role" value={params.role} />}
        <button type="submit" className="px-4 py-2 text-sm rounded bg-foreground text-background">검색</button>
      </form>

      <Card>
        <CardHeader className="px-6 pt-6">
          <h2 className="text-lg font-semibold">사용자 ({rows.length}건)</h2>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">결과 없음.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-6 py-3">이메일</th>
                  <th className="py-3">이름</th>
                  <th className="py-3">현재 역할</th>
                  <th className="py-3">최근 접속</th>
                  <th className="px-6 py-3">역할 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === user.id} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
