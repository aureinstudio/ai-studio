import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCastFullChain } from "@/lib/agents/cast/orchestrator-full";
import { parseAvatarSelection } from "@/lib/agents/cast/avatar-presets";
import { CAST_DAILY_LIMIT_USD } from "@/lib/limits";
import { calculateTtsCost } from "@/lib/external/elevenlabs";
import { calculateVideoCost } from "@/lib/external/heygen";

export const maxDuration = 800;
export const runtime = "nodejs";

const requestSchema = z.object({
  studio_job_id: z.string().uuid(),
  mode: z.enum(["batch", "realtime"]).default("batch"),
  approve_cost: z.boolean(),
  // 아바타 선택 — preset_id (e.g., "f-30s") 또는 "custom:HEYGEN_AVATAR_ID"
  avatar_selection: z.string().default("f-30s"),
  // 음성 소스 — heygen 자체 TTS (기본·저렴) 또는 elevenlabs (고품질)
  voice_source: z.enum(["heygen", "elevenlabs"]).default("heygen"),
});

type SlideMeta = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

/**
 * Cast 비용 추정 — TEAM 1 + 미래 TEAM 2/3 (TTS·Avatar).
 * 본 단계는 TEAM 1 (LLM) 만 실행. 추정값은 사용자 사전 동의용.
 */
function estimateCost(slides: SlideMeta[]): {
  llm: number;
  tts: number;
  video: number;
  total: number;
  estimated_duration_sec: number;
  total_chars: number;
} {
  // 슬라이드 1장당 평균 100단어 스크립트 가정. 한국어 어절 기준 단어 1개 ≈ 5자
  const totalChars = slides.reduce(
    (s, slide) => s + (slide.speaker_notes?.length ?? 0) + 500,
    0,
  );
  // 발화 속도 한국어 ~3 어절/초 = ~15자/초
  const durationSec = Math.ceil(totalChars / 15);
  const llmCost = 0.05 + slides.length * 0.005; // TEAM 1 LLM 비용
  const ttsCost = calculateTtsCost(totalChars);
  const videoCost = calculateVideoCost(durationSec);
  return {
    llm: llmCost,
    tts: ttsCost,
    video: videoCost,
    total: llmCost + ttsCost + videoCost,
    estimated_duration_sec: durationSec,
    total_chars: totalChars,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  // 1. Studio job 로드 + 권한 확인
  const { data: studioJob, error: studioErr } = await supabase
    .from("studio_jobs")
    .select("id, user_id, topic, content, status")
    .eq("id", parsed.data.studio_job_id)
    .single();

  if (studioErr || !studioJob) {
    return NextResponse.json({ error: "studio_job_not_found" }, { status: 404 });
  }
  if (studioJob.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (studioJob.status !== "completed") {
    return NextResponse.json(
      { error: "studio_job_not_completed", current_status: studioJob.status },
      { status: 400 },
    );
  }

  const slides: SlideMeta[] =
    studioJob.content?.planner?.slides ??
    studioJob.content?.team2?.planner?.slides ??
    [];
  if (slides.length === 0) {
    return NextResponse.json({ error: "no_slides_in_studio_job" }, { status: 400 });
  }

  // 2. 비용 추정
  const est = estimateCost(slides);

  // 3. 일일 Cast 한도 확인
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayCosts } = await supabase
    .from("cost_log")
    .select("cost_usd")
    .eq("user_id", user.id)
    .eq("service", "cast")
    .gte("created_at", todayStart.toISOString());
  const usedUsd = (todayCosts ?? []).reduce(
    (s, r) => s + Number(r.cost_usd ?? 0),
    0,
  );
  if (usedUsd + est.llm >= CAST_DAILY_LIMIT_USD) {
    return NextResponse.json(
      {
        error: "cast_daily_limit_reached",
        used_usd: usedUsd,
        limit_usd: CAST_DAILY_LIMIT_USD,
        estimate: est,
        message: `오늘 Cast 사용 비용 $${usedUsd.toFixed(2)}이 일일 한도 $${CAST_DAILY_LIMIT_USD}에 도달했거나 초과할 예정입니다.`,
      },
      { status: 429 },
    );
  }

  // 4. 사용자 사전 동의 확인 — 추정 비용 알면서도 진행 의사 필수
  if (!parsed.data.approve_cost) {
    return NextResponse.json(
      {
        error: "cost_approval_required",
        estimate: est,
        message: "비용 추정치를 확인하고 approve_cost=true로 재요청해주세요.",
      },
      { status: 400 },
    );
  }

  // 5. cast_jobs INSERT (pending)
  const { data: castJob, error: jobErr } = await supabase
    .from("cast_jobs")
    .insert({
      user_id: user.id,
      studio_job_id: parsed.data.studio_job_id,
      mode: parsed.data.mode,
      input_slides: slides,
      status: "pending",
      agent_logs: [],
      estimated_cost_usd: est.total,
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

  // 6. 백그라운드 실행 (TEAM 1만, 외부 API 미사용)
  const isCertification = /자격증|급|시험|기능사|기사|TOEIC|TOEFL/i.test(
    studioJob.topic,
  );
  console.log(`[cast/generate] scheduling TEAM 1 for cast job ${castJob.id}`);
  after(async () => {
    try {
      const admin = createAdminClient();
      const avatar = parseAvatarSelection(parsed.data.avatar_selection);
      await runCastFullChain(
        admin,
        castJob.id,
        user.id,
        studioJob.topic,
        slides,
        isCertification,
        undefined, // model — Studio model 별도 (Cast는 기본 Sonnet)
        avatar.heygen_avatar_id,
        parsed.data.voice_source,
      );
      console.log(`[cast/generate] Full chain completed for cast job ${castJob.id}`);
    } catch (err) {
      console.error(`[cast/generate] Full chain failed for cast job ${castJob.id}:`, err);
    }
  });

  return NextResponse.json({
    cast_job_id: castJob.id,
    status: "pending",
    estimate: est,
  });
}
