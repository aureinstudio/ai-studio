import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/notifications/email";

export const runtime = "nodejs";

const schema = z.object({
  decision: z.enum(["GO", "HOLD", "NO-GO"]),
  rationale: z.string().min(20).max(3000),
  next_actions: z.string().max(2000).nullable().optional(),
  attendees: z.array(z.object({ name: z.string(), role: z.string().optional() })).max(20),
  kpi_snapshot: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: row, error } = await admin
    .from("decision_log")
    .insert({
      gate_id: "G2",
      decision: parsed.data.decision,
      decided_by: user.id,
      attendees: parsed.data.attendees,
      rationale: parsed.data.rationale,
      next_actions: parsed.data.next_actions ?? null,
      kpi_snapshot: parsed.data.kpi_snapshot,
    })
    .select("id, decided_at")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "insert_failed", detail: error?.message }, { status: 500 });
  }

  // CEO·이사회 알림
  const emoji = parsed.data.decision === "GO" ? "🎉" : parsed.data.decision === "HOLD" ? "⏸️" : "🛑";
  await notifyAdmin({
    title: `${emoji} Gate G2 결정: ${parsed.data.decision}`,
    body: parsed.data.rationale,
    fields: [
      { title: "결정자", value: profile?.name ?? user.id.slice(0, 8) },
      { title: "참석자", value: parsed.data.attendees.map((a) => a.name).join(", ") || "(미입력)" },
      ...(parsed.data.next_actions ? [{ title: "다음 단계", value: parsed.data.next_actions }] : []),
      { title: "결정 ID", value: row.id },
    ],
    level: parsed.data.decision === "GO" ? "ok" : parsed.data.decision === "HOLD" ? "warning" : "danger",
    action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/g2-final-report`,
    action_label: "Final Report →",
  });

  // 인시던트로도 영구 기록 (ops 사이클 추적)
  try {
    await admin.from("incidents").insert({
      level: parsed.data.decision === "NO-GO" ? "L3" : "L1",
      category: "gate_decision",
      title: `G2 ${parsed.data.decision}`,
      body: parsed.data.rationale,
      metadata: { decision_id: row.id, kpi_snapshot: parsed.data.kpi_snapshot },
    });
  } catch {}

  return NextResponse.json({ ok: true, decision_id: row.id, decided_at: row.decided_at });
}
