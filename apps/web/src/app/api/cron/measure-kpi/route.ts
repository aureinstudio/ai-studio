import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { measureAll, type HypothesisId } from "@/lib/kpi/measure";
import { notifyAdmin } from "@/lib/notifications/email";

export const runtime = "nodejs";

/**
 * Vercel Cron — 매일 자정 KST (15:00 UTC).
 * 5개 가설 KPI 측정 + hypothesis_metrics 누적 + pass 상태 변화 시 알림.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = await measureAll(admin);

  // 직전 측정 조회 → pass 상태 변화 감지
  const idMap = new Map<HypothesisId, boolean | null>();
  for (const r of results) {
    const { data: prev } = await admin
      .from("hypothesis_metrics")
      .select("passed")
      .eq("hypothesis_id", r.hypothesis_id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    idMap.set(r.hypothesis_id, prev?.passed ?? null);
  }

  // INSERT 새 측정
  await admin.from("hypothesis_metrics").insert(
    results.map((r) => ({
      hypothesis_id: r.hypothesis_id,
      metric_name: r.metric_name,
      value: r.value,
      sample_size: r.sample_size,
      passed: r.passed,
      measurement_window: "daily",
      metadata: r.metadata ?? null,
    })),
  );

  // 변화 알림
  const flips: string[] = [];
  for (const r of results) {
    const prev = idMap.get(r.hypothesis_id);
    if (prev !== null && prev !== r.passed) {
      flips.push(`${r.hypothesis_id}: ${prev ? "PASS" : "FAIL"} → ${r.passed ? "PASS" : "FAIL"}`);
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  if (flips.length > 0) {
    await notifyAdmin({
      title: `🎯 가설 상태 변화 — ${passedCount}/5 통과`,
      body: `다음 가설의 통과 상태가 변경되었습니다:`,
      fields: flips.map((f) => ({ title: f.split(":")[0], value: f })),
      level: passedCount >= 4 ? "ok" : passedCount >= 2 ? "warning" : "danger",
      action_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/hypothesis-tracking`,
      action_label: "가설 추적 →",
    });
  }

  return NextResponse.json({
    ok: true,
    passed_count: passedCount,
    results: results.map((r) => ({
      h: r.hypothesis_id,
      metric: r.metric_name,
      value: r.value,
      n: r.sample_size,
      passed: r.passed,
    })),
    flips,
  });
}
