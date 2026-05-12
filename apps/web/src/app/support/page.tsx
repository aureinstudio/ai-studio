import { createClient } from "@/lib/supabase/server";
import SupportForm from "./form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "문의 — KEG AI Studio",
  description: "기술 문제·콘텐츠 오류·기타 문의 24시간 응대 SLA",
};

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let email: string | null = null;
  let name: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", user.id)
      .maybeSingle();
    email = profile?.email ?? null;
    name = profile?.name ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">문의 채널</h1>
      <p className="text-sm text-muted-foreground mb-8">
        기술 문제·콘텐츠 오류·결제 문의 등을 보내주세요. 24시간 이내 응대해 드립니다.
      </p>
      <SupportForm prefillEmail={email} prefillName={name} />
    </div>
  );
}
