import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { period, efficiency_score, value_elevation_score, recommend_score, comments } = body;

  for (const v of [efficiency_score, value_elevation_score, recommend_score]) {
    if (typeof v !== "number" || v < 0 || v > 10) {
      return NextResponse.json({ error: "scores must be 0-10" }, { status: 400 });
    }
  }
  if (!/^\d{4}-\d{2}$/.test(period ?? "")) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }

  const { error } = await supabase
    .from("instructor_nps")
    .upsert(
      {
        instructor_id: user.id,
        period,
        efficiency_score,
        value_elevation_score,
        recommend_score,
        comments: comments?.toString().slice(0, 2000) ?? null,
      },
      { onConflict: "instructor_id,period" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
