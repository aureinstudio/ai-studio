import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runStudioChain } from "@/lib/agents/orchestrator";

// Vercel function 최대 실행 시간 — after() 콜백 포함 60s budget
export const maxDuration = 60;
export const runtime = "nodejs";

const requestSchema = z.object({
  topic: z.string().min(1, "주제를 입력해주세요").max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  length: z.enum(["short", "medium", "long"]),
});

export async function POST(request: NextRequest) {
  // 1. 인증
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 요청 검증
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

  // 3. job pending 생성 (즉시 응답용)
  const { data: job, error: jobError } = await supabase
    .from("studio_jobs")
    .insert({
      user_id: user.id,
      topic: parsed.data.topic,
      level: parsed.data.level,
      length: parsed.data.length,
      status: "pending",
      agent_logs: [],
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "job_creation_failed", detail: jobError?.message },
      { status: 500 },
    );
  }

  // 4. 응답 후 백그라운드 실행 — after() 콜백에서 체인 진행
  // ⚠️ cookies-based supabase 클라이언트는 요청 종료 후 RLS 체크가 실패할 수 있음.
  //    백그라운드 작업은 service-role 클라이언트로 — RLS 우회, auth context 불필요.
  console.log(`[studio/generate] scheduling chain for job ${job.id}`);
  after(async () => {
    console.log(`[studio/generate] after() callback started for job ${job.id}`);
    try {
      const admin = createAdminClient();
      await runStudioChain(admin, job.id, user.id, parsed.data);
      console.log(`[studio/generate] chain completed for job ${job.id}`);
    } catch (err) {
      console.error(`[studio/generate] chain failed for job ${job.id}:`, err);
      // orchestrator가 이미 status='failed'로 업데이트함 — 추가 작업 X
    }
  });

  return NextResponse.json({ jobId: job.id, status: "pending" });
}
