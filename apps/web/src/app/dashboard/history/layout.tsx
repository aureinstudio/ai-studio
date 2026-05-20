import { createClient } from "@/lib/supabase/server";
import { TabNav } from "./TabNav";

export const dynamic = "force-dynamic";

const STUDIO_PRO_ROLES = new Set([
  "instructor",
  "creator",
  "admin",
  "keg_super_admin",
  "tenant_admin",
  "sme",
]);

export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let showStudioPro = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    showStudioPro = STUDIO_PRO_ROLES.has((profile?.role as string) ?? "");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <TabNav showStudioPro={showStudioPro} />
      {children}
    </div>
  );
}
