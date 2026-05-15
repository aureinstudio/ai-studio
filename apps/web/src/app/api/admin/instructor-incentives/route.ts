import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeMonthlyIncentives } from "@/lib/agents/instructor/compute-incentives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { error: null };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  const results = await computeMonthlyIncentives(period);
  return NextResponse.json({ period, instructor_count: results.length, results });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => ({}));
  const period = body.period ?? new Date().toISOString().slice(0, 7);

  const results = await computeMonthlyIncentives(period);

  const rows: Array<Record<string, unknown>> = [];
  for (const r of results) {
    for (const inc of r.incentives) {
      rows.push({
        instructor_id: r.instructor.id,
        period,
        tier: inc.tier,
        amount_krw: inc.amount_krw,
        bonus_percent: inc.bonus_percent,
        reason: inc.reason,
        metrics_snapshot: r.metrics,
      });
    }
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, saved: 0, period, note: "지급 대상 없음" });

  const admin = createAdminClient();
  const { error } = await admin
    .from("instructor_incentives")
    .upsert(rows, { onConflict: "instructor_id,period,tier" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: rows.length, period });
}
