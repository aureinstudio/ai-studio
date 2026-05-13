import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateVideoCost } from "@/lib/external/heygen";
import { logCost } from "@/lib/cost-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HeyGen 영상 완료 webhook.
 *
 * HeyGen이 영상 렌더링 완료/실패 시 POST 호출:
 *   - event_type: "avatar_video.success" | "avatar_video.fail"
 *   - event_data: { video_id, url?, duration?, callback_id? }
 *
 * cast_jobs.heygen_video_id (또는 callback_id) 로 매칭 → status·video_url 업데이트.
 *
 * 보안: HeyGen webhook signature 검증은 추후 (X-HeyGen-Signature 헤더).
 * 현재는 video_id 매칭으로만 검증.
 */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // HeyGen webhook 페이로드 구조
  const event = payload as {
    event_type?: string;
    event_data?: {
      video_id?: string;
      url?: string;
      gif_download_url?: string;
      video_share_page_url?: string;
      duration?: number;
      callback_id?: string;
      msg?: string;
    };
  };

  const videoId = event.event_data?.video_id;
  const callbackId = event.event_data?.callback_id; // cast_job_id 가능
  if (!videoId && !callbackId) {
    return NextResponse.json({ error: "missing_identifier" }, { status: 400 });
  }

  console.log(
    `[heygen webhook] event=${event.event_type} video_id=${videoId?.slice(0, 8)} callback_id=${callbackId?.slice(0, 8)}`,
  );

  const admin = createAdminClient();

  // 매칭: 우선 callback_id (cast_job.id), 없으면 heygen_video_id
  let query = admin.from("cast_jobs").select("*");
  if (callbackId) {
    query = query.eq("id", callbackId);
  } else if (videoId) {
    query = query.eq("heygen_video_id", videoId);
  }
  const { data: job, error: jobErr } = await query.maybeSingle();

  if (jobErr || !job) {
    console.error(
      `[heygen webhook] cast_job not found for video_id=${videoId} callback_id=${callbackId}: ${jobErr?.message}`,
    );
    // HeyGen에 200 반환 — 재시도 방지 (잘못된 매칭이면 우리 책임)
    return NextResponse.json({ status: "ignored", reason: "job_not_found" });
  }

  const isSuccess = event.event_type === "avatar_video.success";
  const isFail = event.event_type === "avatar_video.fail";

  if (isSuccess) {
    const videoUrl = event.event_data?.url ?? "";
    let durationSec = event.event_data?.duration ?? 0;

    // HeyGen이 duration 안 보내는 경우 대비: status API에서 직접 조회.
    // 이거 빠지면 cost_usd=0 (4a61d71e 같은 케이스).
    if ((!durationSec || durationSec === 0) && videoId && process.env.HEYGEN_API_KEY) {
      try {
        const statusRes = await fetch(
          `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
          { headers: { "X-Api-Key": process.env.HEYGEN_API_KEY } },
        );
        if (statusRes.ok) {
          const j = (await statusRes.json()) as { data?: { duration?: number } };
          if (j.data?.duration) durationSec = j.data.duration;
        }
      } catch (err) {
        console.warn("[heygen webhook] status fetch failed (continuing with 0):", err);
      }
    }

    const costUsd = calculateVideoCost(durationSec);

    // agent_logs의 cast-04 항목을 'completed'로 업데이트
    type AgentLog = {
      agent_id: string;
      agent_name: string;
      status: string;
      cost_usd: number;
      tokens_out: number;
      completed_at: string;
      duration_ms: number;
      error?: string;
    };
    const logs = (job.agent_logs ?? []) as AgentLog[];
    const updatedLogs = logs.map((log) => {
      if (log.agent_id === "cast-04" && log.status === "started") {
        return {
          ...log,
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(log.completed_at).getTime(),
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
        agent_logs: updatedLogs,
        cost_usd: totalCost,
        duration_seconds: durationSec,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // cost_log 업데이트
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
        heygen_video_id: videoId,
        duration_sec: durationSec,
        via: "webhook",
      },
    });

    console.log(
      `[heygen webhook] cast_job ${job.id} completed (${durationSec}s, $${costUsd.toFixed(4)})`,
    );
    return NextResponse.json({ status: "ok", cast_job_id: job.id });
  }

  if (isFail) {
    const errorMsg = event.event_data?.msg ?? "HeyGen rendering failed";
    await admin
      .from("cast_jobs")
      .update({
        status: "failed",
        error_message: errorMsg,
      })
      .eq("id", job.id);
    console.warn(`[heygen webhook] cast_job ${job.id} failed: ${errorMsg}`);
    return NextResponse.json({ status: "ok", cast_job_id: job.id, error: errorMsg });
  }

  // 알 수 없는 event_type
  return NextResponse.json({ status: "ignored", event_type: event.event_type });
}

// GET — 디버깅용 (HeyGen이 URL 검증 시 GET 요청 보낼 수 있음)
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "heygen webhook" });
}
