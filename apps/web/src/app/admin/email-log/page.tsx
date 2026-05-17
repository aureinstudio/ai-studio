import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  queued: "bg-zinc-100 text-zinc-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  bounced: "bg-amber-100 text-amber-700",
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: logs } = await admin.from("email_log").select("*").order("created_at", { ascending: false }).limit(100);

  const stats = (logs ?? []).reduce((acc, l) => {
    acc[l.status as string] = (acc[l.status as string] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">이메일 로그</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resend 발송 추적. 실패 항목 모니터링.</p>
      </header>

      <div className="mb-6 grid grid-cols-4 gap-4">
        {(["queued","sent","failed","bounced"] as const).map((s) => (
          <div key={s} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{s}</div>
            <div className="mt-1 text-2xl font-bold">{stats[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">시점</th>
            <th className="px-3 py-2 text-left">수신자</th>
            <th className="px-3 py-2 text-left">제목</th>
            <th className="px-3 py-2 text-left">템플릿</th>
            <th className="px-3 py-2 text-left">상태</th>
            <th className="px-3 py-2 text-left">에러</th>
          </tr>
        </thead>
        <tbody>
          {(logs ?? []).map((l) => (
            <tr key={l.id} className="border-b last:border-b-0">
              <td className="px-3 py-2 text-xs">{new Date(l.created_at).toLocaleString("ko-KR")}</td>
              <td className="px-3 py-2 text-xs">{l.recipient}</td>
              <td className="px-3 py-2 text-xs truncate max-w-xs">{l.subject}</td>
              <td className="px-3 py-2 text-xs">{l.template ?? "—"}</td>
              <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLS[l.status as string] ?? "bg-zinc-100"}`}>{l.status}</span></td>
              <td className="px-3 py-2 text-xs text-red-600 max-w-xs truncate">{l.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
