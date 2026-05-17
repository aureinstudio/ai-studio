import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import IssueCertificateForm from "./issue-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","keg_super_admin","operations","instructor","sme"].includes(profile?.role ?? "")) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: certs } = await admin
    .from("certificates")
    .select("id, certificate_number, student_name, course_name, score, issued_at")
    .order("issued_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">수료증 발급</h1>
        <p className="mt-1 text-sm text-muted-foreground">학생 수료 시 수료증 발급. /certificates/{`{number}`}에서 누구나 검증 가능.</p>
      </header>

      <section className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">새 수료증 발급</h2>
        <IssueCertificateForm />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-6 py-3"><h2 className="font-semibold">최근 발급 ({certs?.length ?? 0})</h2></div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">번호</th>
              <th className="px-3 py-2 text-left">수강생</th>
              <th className="px-3 py-2 text-left">과정</th>
              <th className="px-3 py-2 text-right">점수</th>
              <th className="px-3 py-2 text-left">발급일</th>
              <th className="px-3 py-2 text-left">링크</th>
            </tr>
          </thead>
          <tbody>
            {(certs ?? []).map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-mono text-xs">{c.certificate_number}</td>
                <td className="px-3 py-2">{c.student_name}</td>
                <td className="px-3 py-2">{c.course_name}</td>
                <td className="px-3 py-2 text-right font-mono">{c.score ? Number(c.score).toFixed(1) : "—"}</td>
                <td className="px-3 py-2 text-xs">{new Date(c.issued_at).toLocaleDateString("ko-KR")}</td>
                <td className="px-3 py-2"><Link href={`/certificates/${c.certificate_number}`} target="_blank" className="text-xs text-blue-600 hover:underline">보기 →</Link></td>
              </tr>
            ))}
            {(!certs || certs.length === 0) && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">아직 수료증 없음.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
