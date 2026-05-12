import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AskClient } from "./AskClient";

export const dynamic = "force-dynamic";

type UserAvatar = {
  id: string;
  heygen_talking_photo_id: string;
  label: string;
  gender: "male" | "female" | null;
  source_image_url: string | null;
};

export default async function CastAskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cast/ask");

  const { data: avatars } = await supabase
    .from("user_avatars")
    .select("id, heygen_talking_photo_id, label, gender, source_image_url")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<UserAvatar[]>();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Cast · Mode B · 실시간 응답
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          질문 → 영상 답변
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          학생 질문을 입력하면 강사 avatar가 짧은 영상 (1~3분) 답변을 생성합니다.
          비용 ~$1/회, 일일 5회 한도.
        </p>
      </div>

      <AskClient
        avatars={(avatars ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          gender: a.gender,
          source_image_url: a.source_image_url,
        }))}
      />
    </div>
  );
}
