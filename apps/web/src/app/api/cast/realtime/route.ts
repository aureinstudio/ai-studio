import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CastOrchestrator } from "@/lib/agents/cast/cast-orchestrator";
import { submitHeyGenVideo, type VoiceScene } from "@/lib/agents/cast/avatar-video";
import { logCost } from "@/lib/cost-tracker";
import {
  CAST_MODE_B_MAX_USD_PER_CALL,
  CAST_MODE_B_DAILY_CALLS,
} from "@/lib/limits";
import type { AgentLog } from "@/lib/agents/base";

export const maxDuration = 60;
export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().min(5).max(500),
  course_context: z.string().max(300).optional(),
  /** user_avatars.id 또는 "custom:HEYGEN_ID" — 미제공 시 차단 */
  avatar_selection: z.string().min(1),
  voice_id: z.string().optional(),
  max_duration_seconds: z.number().int().min(30).max(180).default(120),
});

export async function POST(request: NextRequest) {
  // 1. 인증
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 2. 검증
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // 3. Mode B 일일 호출 횟수 한도
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from("cast_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("mode", "realtime")
    .gte("created_at", todayStart.toISOString());

  if ((todayCount ?? 0) >= CAST_MODE_B_DAILY_CALLS) {
    return NextResponse.json(
      {
        error: "mode_b_daily_limit_reached",
        used: todayCount,
        limit: CAST_MODE_B_DAILY_CALLS,
        message: `오늘 Mode B 호출 ${todayCount}회로 한도 ${CAST_MODE_B_DAILY_CALLS}회에 도달했습니다.`,
      },
      { status: 429 },
    );
  }

  // 4. 아바타 ID 해석
  const admin = createAdminClient();
  let avatarHeygenId: string;
  let voiceId =
    parsed.data.voice_id ?? "1bd001e7e50f421d891986aad5158bc8";

  if (parsed.data.avatar_selection.startsWith("user:")) {
    const userAvatarId = parsed.data.avatar_selection.slice("user:".length);
    const { data: ua } = await admin
      .from("user_avatars")
      .select("heygen_talking_photo_id, gender")
      .eq("id", userAvatarId)
      .eq("user_id", user.id)
      .single();
    if (!ua) {
      return NextResponse.json(
        { error: "avatar_not_found", id: userAvatarId },
        { status: 404 },
      );
    }
    avatarHeygenId = ua.heygen_talking_photo_id;
    if (!parsed.data.voice_id) {
      voiceId =
        ua.gender === "male"
          ? "9d81087c3f9a45df8c22ab91cf46ca89"
          : "bef4755ca1f442359c2fe6420690c8f7";
    }
  } else if (parsed.data.avatar_selection.startsWith("custom:")) {
    avatarHeygenId = parsed.data.avatar_selection.slice("custom:".length);
  } else {
    return NextResponse.json(
      { error: "invalid_avatar_selection", message: "user:UUID 또는 custom:ID 형식 필요" },
      { status: 400 },
    );
  }

  // 5. cast_job 생성 (pending)
  const { data: castJob, error: jobErr } = await admin
    .from("cast_jobs")
    .insert({
      user_id: user.id,
      mode: "realtime",
      status: "pending",
      input_slides: { question: parsed.data.question },
      agent_logs: [],
      approved: true,
    })
    .select("id")
    .single();

  if (jobErr || !castJob) {
    return NextResponse.json(
      { error: "cast_job_creation_failed", detail: jobErr?.message },
      { status: 500 },
    );
  }

  // 6. 백그라운드 실행 (Mode B chain — webhook 모드)
  const origin =
    request.headers.get("origin") ??
    `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`;
  const webhookUrl = `${origin}/api/cast/webhooks/heygen`;

  after(async () => {
    const agent_logs: AgentLog[] = [];
    const persistLogs = () =>
      admin.from("cast_jobs").update({ agent_logs }).eq("id", castJob.id);

    try {
      await admin.from("cast_jobs").update({ status: "running" }).eq("id", castJob.id);

      // ─ #06 오케스트레이터 (질문 검증 + 답변 생성)
      const orchestrator = new CastOrchestrator();
      const r06 = await orchestrator.execute({
        mode: "mode-b",
        question: parsed.data.question,
        course_context: parsed.data.course_context,
        max_duration_seconds: parsed.data.max_duration_seconds,
      });
      agent_logs.push(r06.log);
      await persistLogs();
      await logCost({
        supabase: admin,
        service: "cast",
        endpoint: "/api/cast/realtime",
        userId: user.id,
        tokensIn: r06.log.tokens_in,
        tokensOut: r06.log.tokens_out,
        costUsd: r06.log.cost_usd,
        metadata: { cast_job_id: castJob.id, agent_id: "cast-06" },
      });

      // 부적절한 질문 → 실패 처리
      if (!r06.output.is_appropriate) {
        await admin
          .from("cast_jobs")
          .update({
            status: "failed",
            error_message: `부적절한 질문: ${r06.output.reason}`,
            output: { reason: r06.output.reason, is_appropriate: false },
            agent_logs,
          })
          .eq("id", castJob.id);
        return;
      }

      // 비용 추정 — 임계값 초과 시 차단
      if (r06.output.estimated_cost_usd > CAST_MODE_B_MAX_USD_PER_CALL) {
        await admin
          .from("cast_jobs")
          .update({
            status: "failed",
            error_message: `Mode B 호출당 한도 $${CAST_MODE_B_MAX_USD_PER_CALL} 초과 (추정 $${r06.output.estimated_cost_usd.toFixed(2)})`,
            agent_logs,
          })
          .eq("id", castJob.id);
        return;
      }

      // ─ HeyGen 영상 제출 (단일 scene)
      const scene: VoiceScene = {
        slide_number: 1,
        text: r06.output.answer_text,
      };
      const submittedAt = new Date().toISOString();
      const videoLog: AgentLog = {
        agent_id: "cast-04",
        agent_name: "아바타 영상 합성",
        status: "started",
        started_at: submittedAt,
        completed_at: submittedAt,
        duration_ms: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        error: "HeyGen 제출 — webhook 대기 중",
      };
      agent_logs.push(videoLog);
      await persistLogs();

      const { video_id } = await submitHeyGenVideo(
        [scene],
        `Q&A: ${parsed.data.question.slice(0, 30)}`,
        castJob.id,
        avatarHeygenId,
        voiceId,
        webhookUrl,
      );

      videoLog.error = `HeyGen 제출됨 (video_id: ${video_id.slice(0, 8)}…) — webhook 대기 중`;
      await persistLogs();

      await admin
        .from("cast_jobs")
        .update({
          status: "rendering",
          heygen_video_id: video_id,
          output: {
            question: parsed.data.question,
            answer_text: r06.output.answer_text,
            estimated_duration_seconds: r06.output.estimated_duration_seconds,
          },
          cost_usd: r06.log.cost_usd, // LLM 비용만 우선 기록 (영상은 webhook에서 추가)
          agent_logs,
        })
        .eq("id", castJob.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cast/realtime] failed for cast_job ${castJob.id}:`, err);
      await admin
        .from("cast_jobs")
        .update({
          status: "failed",
          error_message: message,
          agent_logs,
        })
        .eq("id", castJob.id);
    }
  });

  return NextResponse.json({
    cast_job_id: castJob.id,
    status: "pending",
    remaining_today: Math.max(0, CAST_MODE_B_DAILY_CALLS - (todayCount ?? 0) - 1),
  });
}
