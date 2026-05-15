import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import RetroForm from "./form";
import RetroEntry from "./entry";

export const dynamic = "force-dynamic";

type Entry = {
  id: string;
  category: "went_well" | "tough" | "do_differently";
  content: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
};

const CAT_META = {
  went_well: { label: "잘 된 것", emoji: "✅", cls: "bg-emerald-50 border-emerald-200" },
  tough: { label: "어려웠던 것", emoji: "🚧", cls: "bg-amber-50 border-amber-200" },
  do_differently: { label: "다음에 다르게 할 것", emoji: "🔄", cls: "bg-blue-50 border-blue-200" },
} as const;

export default async function RetrospectivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/retrospective");
  const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("retrospective_entries")
    .select("id, category, content, author_id, author_name, created_at")
    .eq("gate_id", "G2")
    .order("created_at", { ascending: false })
    .limit(500);

  const grouped: Record<string, Entry[]> = { went_well: [], tough: [], do_differently: [] };
  for (const e of (entries ?? []) as Entry[]) {
    grouped[e.category]?.push(e);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">베타 4주 회고</h1>
          <p className="mt-1 text-sm text-muted-foreground">TF 8명 누구나 자유 입력 · Gate G2 의사결정 보조 자료</p>
        </div>
        <Link href="/admin" className="text-sm hover:underline">← 관리자 홈</Link>
      </header>

      <RetroForm userName={profile?.name ?? null} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(CAT_META) as (keyof typeof CAT_META)[]).map((cat) => {
          const meta = CAT_META[cat];
          const items = grouped[cat] ?? [];
          return (
            <Card key={cat} className={meta.cls}>
              <CardHeader className="px-5 pt-5">
                <h2 className="text-base font-semibold">{meta.emoji} {meta.label} ({items.length})</h2>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">아직 의견 없음.</p>
                ) : (
                  items.map((e) => (
                    <RetroEntry
                      key={e.id}
                      id={e.id}
                      content={e.content}
                      author={e.author_name}
                      createdAt={e.created_at}
                      isOwn={e.author_id === user.id}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
