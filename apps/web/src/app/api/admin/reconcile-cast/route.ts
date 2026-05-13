import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateVideoCost } from "@/lib/external/heygen";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 120;

type AgentLog = {
  agent_id: string;
  agent_name?: string;
  status: string;
  cost_usd?: number;
  tokens_out?: number;
  completed_at?: string;
  duration_ms?: number;
  started_at?: string;
  error?: string;
};

type ReconcileResult =
  | { action: "completed"; duration_seconds: number; cost_usd: number; video_url: string }
  | { action: "failed"; error: string }
  | { action: "still_processing"; heygen_status?: string }
  | { action: "already_terminal"; current: string }
  | { action: "no_heygen_video_id" }
  | { action: "skipped"; reason: string };

/**
 * 단일 cast_job HeyGen 재조회 + DB 회수.
 */
async function reconcileOne(
  admin: SupabaseClient,
  jobId: string,
): Promise<ReconcileResult> {
  const { data: job } = await admin
    .from("cast_jobs")
    .select("id, user_id, status, heygen_video_id, cost_usd, agent_logs, video_url")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { action: "skipped", reason: "job_not_found" };
  if (!job.heygen_video_id) return { action: "no_heygen_video_id" };

  // 이미 완전히 처리된 케이스 — 건너뜀
  if (
    (job.status === "completed" || job.status === "failed") &&
    job.video_url
  ) {
    return { action: "already_terminal", current: job.status };
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY missing");

  const statusRes = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(job.heygen_video_id)}`,
    { headers: { "X-Api-Key": apiKey } },
  );
  if (!statusRes.ok) {
    const txt = await statusRes.text().catch(() => "");
    throw new Error(`heygen_status_failed: ${txt.slice(0, 200)}`);
  }
  const j = (await statusRes.json()) as {
    data?: {
      status?: string;
      video_url?: string;
      duration?: number;
      error?: { message?: string };
    };
  };
  const hgStatus = j.data?.status;

  if (hgStatus === "completed") {
    const videoUrl = j.data?.video_url ?? "";
    const durationRaw = j.data?.duration ?? 0;
    const durationSec = Math.round(durationRaw); // INT4 column 호환
    const costUsd = calculateVideoCost(durationRaw); // 정밀 비용

    const logs = (job.agent_logs ?? []) as AgentLog[];
    const updatedLogs = logs.map((log) =>
      log.agent_id === "cast-04" && log.status === "started"
        ? {
            ...log,
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(log.started_at ?? Date.now()).getTime(),
            tokens_out: durationSec,
            cost_usd: costUsd,
            error: undefined,
          }
        : log,
    );

    const totalCost = (Number(job.cost_usd) || 0) + costUsd;
    const { error: upErr } = await admin
      .from("cast_jobs")
      .update({
        status: "completed",
        video_url: videoUrl,
        duration_seconds: durationSec,
        cost_usd: totalCost,
        agent_logs: updatedLogs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (upErr) throw new Error(`update_failed: ${upErr.message}`);

    await logCost({
      supabase: admin,
      service: "heygen",
      endpoint: "/v2/video/generate",
      userId: job.user_id,
      tokensIn: 0,
      tokensOut: 0,
      costUsd,
      metadata: {
        cast_job_id: job.id,
        heygen_video_id: job.heygen_video_id,
        duration_sec: durationSec,
        via: "reconcile",
      },
    });

    return { action: "completed", duration_seconds: durationSec, cost_usd: costUsd, video_url: videoUrl };
  }

  if (hgStatus === "failed") {
    const errMsg = j.data?.error?.message ?? "HeyGen rendering failed";
    await admin
      .from("cast_jobs")
      .update({ status: "failed", error_message: errMsg })
      .eq("id", job.id);
    return { action: "failed", error: errMsg };
  }

  return { action: "still_processing", heygen_status: hgStatus };
}

/**
 * GET /api/admin/reconcile-cast
 *
 * 미해결 또는 cost=0 cast_jobs 목록.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("cast_jobs")
    .select("id, status, heygen_video_id, cost_usd, video_url, created_at")
    .not("heygen_video_id", "is", null)
    .or("status.eq.running,status.eq.rendering,cost_usd.eq.0")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ candidates: data ?? [] });
}

/**
 * POST /api/admin/reconcile-cast
 *   body: { job_id: "uuid" }          단일 회수
 *   body: { batch: true }             cost=0 또는 running 상태 50건 일괄 회수
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { job_id?: string; batch?: boolean };
  const admin = createAdminClient();

  if (body.batch === true) {
    const { data: candidates } = await admin
      .from("cast_jobs")
      .select("id")
      .not("heygen_video_id", "is", null)
      .or("status.eq.running,status.eq.rendering,cost_usd.eq.0")
      .order("created_at", { ascending: false })
      .limit(50);

    const results: { job_id: string; result: ReconcileResult | { error: string } }[] = [];
    for (const c of candidates ?? []) {
      try {
        const r = await reconcileOne(admin, c.id);
        results.push({ job_id: c.id, result: r });
      } catch (e) {
        results.push({ job_id: c.id, result: { error: e instanceof Error ? e.message : String(e) } });
      }
    }
    const recovered = results.filter((r) => "action" in r.result && r.result.action === "completed");
    const totalCost = recovered.reduce(
      (s, r) => s + ("action" in r.result && r.result.action === "completed" ? r.result.cost_usd : 0),
      0,
    );
    return NextResponse.json({
      ok: true,
      mode: "batch",
      scanned: results.length,
      recovered: recovered.length,
      total_cost_recovered_usd: Number(totalCost.toFixed(2)),
      results,
    });
  }

  if (!body.job_id) {
    return NextResponse.json({ error: "job_id or batch:true required" }, { status: 400 });
  }
  try {
    const r = await reconcileOne(admin, body.job_id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { error: "reconcile_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
