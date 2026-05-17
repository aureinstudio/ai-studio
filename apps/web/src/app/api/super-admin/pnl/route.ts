import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["keg_super_admin","admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.period || !/^\d{4}-\d{2}$/.test(body.period)) {
    return NextResponse.json({ error: "period (YYYY-MM) required" }, { status: 400 });
  }
  const { error } = await supabase.from("pnl_snapshots").upsert({
    period: body.period,
    b2c_revenue_krw: Number(body.b2c_revenue_krw) || 0,
    b2b_revenue_krw: Number(body.b2b_revenue_krw) || 0,
    ai_cost_krw: Number(body.ai_cost_krw) || 0,
    personnel_cost_krw: Number(body.personnel_cost_krw) || 0,
    marketing_cost_krw: Number(body.marketing_cost_krw) || 0,
    infra_cost_krw: Number(body.infra_cost_krw) || 0,
    other_cost_krw: Number(body.other_cost_krw) || 0,
  }, { onConflict: "tenant_id,period" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
