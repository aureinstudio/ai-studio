import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataRightsClient } from "./DataRightsClient";

export const dynamic = "force-dynamic";

export default async function DataRightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/legal/data-rights");

  // 프로필 조회 (계정 삭제 요청 상태 확인)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, deletion_requested_at, deletion_scheduled_at")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal · Data Rights
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-foreground">데이터 권리</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        개인정보 보호법에 따라 본인 데이터를 다운로드하거나 계정·데이터 삭제를 요청할 수 있습니다.
      </p>

      <DataRightsClient
        email={profile?.email ?? user.email ?? ""}
        deletionRequestedAt={profile?.deletion_requested_at}
        deletionScheduledAt={profile?.deletion_scheduled_at}
      />
    </div>
  );
}
