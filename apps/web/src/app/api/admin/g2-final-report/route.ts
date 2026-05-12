import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildG2FinalReport } from "@/lib/kpi/g2-report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const windowDays = Number(new URL(request.url).searchParams.get("days") ?? "28");

  const admin = createAdminClient();
  const report = await buildG2FinalReport(admin, windowDays);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
