import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NpsForm from "./nps-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/instructor/nps");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin") redirect("/dashboard");

  const period = new Date().toISOString().slice(0, 7);
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("instructor_nps")
    .select("efficiency_score, value_elevation_score, recommend_score, comments")
    .eq("instructor_id", user.id)
    .eq("period", period)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">강사 월간 NPS — {period}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ai-studio가 강사 가치를 격상시키는지 측정합니다. 응답은 본인·관리자만 조회 가능합니다.
      </p>
      <div className="mt-6">
        <NpsForm period={period} initial={existing ?? null} />
      </div>
    </div>
  );
}
