import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateVideoCost } from "@/lib/external/heygen";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

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

/**
 * POST /api/admin/reconcile-cast  — body: { job_id?: string }
 * GET  /api/admin/reconcile-cast  — 미해결 job 목록 (status='running' AND heygen_video_id IS NOT NULL)
 *
 * Webhook 누락으로 'running' 상태에 멈춘 cast_jobs를 HeyGen 직접 조회로 회수.
 * - HeyGen completed → DB completed + video_url + duration + cost 갱신
 * - HeyGen failed → DB failed + error_message
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
    .select("id, status, heygen_video_id, created_at")
    .in("status", ["running", "rendering"])
    .not("heygen_video_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ stuck: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const jobId = (body as { job_id?: string }).job_id;
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("cast_jobs")
    .select("id, user_id, status, heygen_video_id, cost_usd, agent_logs")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (!job.heygen_video_id) {
    return NextResponse.json({ error: "no_heygen_video_id" }, { status: 400 });
  }
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({ ok: true, status: "already_terminal", current: job.status });
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY missing" }, { status: 500 });

  const statusRes = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(job.heygen_video_id)}`,
    { headers: { "X-Api-Key": apiKey } },
  );
  if (!statusRes.ok) {
    const txt = await statusRes.text().catch(() => "");
    return NextResponse.json({ error: "heygen_status_failed", detail: txt.slice(0, 400) }, { status: 502 });
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
    const durationSec = j.data?.duration ?? 0;
    const costUsd = calculateVideoCost(durationSec);

    const logs = (job.agent_logs ?? []) as AgentLog[];
    const updatedLogs = logs.map((log) => {
      if (log.agent_id === "cast-04" && log.status === "started") {
        return {
          ...log,
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(log.started_at ?? Date.now()).getTime(),
          tokens_out: durationSec,
          cost_usd: costUsd,
          error: undefined,
        };
      }
      return log;
    });

    const totalCost = (Number(job.cost_usd) || 0) + costUsd;
    await admin
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

    return NextResponse.json({
      ok: true,
      action: "completed",
      duration_seconds: durationSec,
      cost_usd: costUsd,
      video_url: videoUrl,
    });
  }

  if (hgStatus === "failed") {
    const errMsg = j.data?.error?.message ?? "HeyGen rendering failed";
    await admin
      .from("cast_jobs")
      .update({ status: "failed", error_message: errMsg })
      .eq("id", job.id);
    return NextResponse.json({ ok: true, action: "failed", error: errMsg });
  }

  // 아직 처리 중 (HeyGen processing)
  return NextResponse.json({
    ok: true,
    action: "still_processing",
    heygen_status: hgStatus,
  });
}
