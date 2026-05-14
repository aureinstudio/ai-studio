import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDynamicChain } from "@/lib/agents/orchestrator-dynamic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["text/plain", "text/markdown", ""]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const VALID_CATEGORY = new Set(["certification", "professional", "language", "hobby", "academic"]);

/**
 * POST /api/studio-pro/generate
 * multipart/form-data:
 *   - title (string)
 *   - course_category (string)
 *   - synthesize_video ("0"|"1")
 *   - file (.md / .txt)
 *
 * 흐름:
 *   1. 강사 인증 + 파일 검증
 *   2. studio_pro_jobs(status='extracting') 생성
 *   3. 파일을 studio-pro-uploads 버킷에 업로드
 *   4. 텍스트 추출 (md/txt — 단순 디코드)
 *   5. status='enhancing' → Studio orchestrator 실행 (재사용)
 *   6. (옵션) status='synthesizing_video' → Cast 파이프라인 트리거
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["instructor", "admin", "sme", "creator"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid form-data" }, { status: 400 });

  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const category = String(form.get("course_category") ?? "professional");
  const synthVideo = String(form.get("synthesize_video") ?? "0") === "1";
  const file = form.get("file");

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!VALID_CATEGORY.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `file too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 400 });

  // 확장자 화이트리스트
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".txt")) {
    return NextResponse.json({ error: "only .md / .txt supported in v0.43" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    // 일부 브라우저는 mime을 빈 문자열로 보냄 — 확장자만 통과
  }

  const admin = createAdminClient();

  // 1) studio_pro_jobs row
  const { data: proJob, error: insErr } = await admin
    .from("studio_pro_jobs")
    .insert({
      instructor_id: user.id,
      title,
      source_file_type: lower.endsWith(".md") ? "md" : "txt",
      status: "extracting",
    })
    .select("id")
    .single();
  if (insErr || !proJob) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  // 2) 파일 업로드
  const bytes = new Uint8Array(await file.arrayBuffer());
  const objectPath = `${user.id}/${proJob.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await admin.storage.from("studio-pro-uploads").upload(objectPath, bytes, {
    contentType: file.type || "text/plain",
    upsert: false,
  });
  if (upErr) {
    await admin.from("studio_pro_jobs").update({ status: "failed", error: `upload failed: ${upErr.message}` }).eq("id", proJob.id);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // 3) 텍스트 추출 (md/txt — 직접 디코드)
  const extracted = new TextDecoder("utf-8").decode(bytes).trim();
  if (extracted.length < 50) {
    await admin.from("studio_pro_jobs").update({ status: "failed", error: "extracted text too short (<50 chars)" }).eq("id", proJob.id);
    return NextResponse.json({ error: "extracted text too short" }, { status: 400 });
  }

  await admin.from("studio_pro_jobs").update({
    source_file_url: objectPath,
    extracted_text: extracted.slice(0, 50_000),
    status: "enhancing",
  }).eq("id", proJob.id);

  // 4) Studio orchestrator 트리거 (백그라운드)
  //    topic = 추출 텍스트 첫 1000자 (요약 시드) — orchestrator가 RAG/research로 보강
  const seedTopic = `${title}\n\n[기존 자료 요약]\n${extracted.slice(0, 1500)}`;

  const { data: studioJob, error: sjErr } = await admin
    .from("studio_jobs")
    .insert({
      user_id: user.id,
      topic: seedTopic.slice(0, 2000),
      level: "intermediate",
      length: "medium",
      model: "claude-sonnet-4-5",
      course_category: category,
      status: "pending",
      agent_logs: [],
    })
    .select("id")
    .single();

  if (sjErr || !studioJob) {
    await admin.from("studio_pro_jobs").update({ status: "failed", error: `studio_job creation failed: ${sjErr?.message}` }).eq("id", proJob.id);
    return NextResponse.json({ error: sjErr?.message ?? "studio_job failed" }, { status: 500 });
  }

  await admin.from("studio_pro_jobs").update({ studio_job_id: studioJob.id }).eq("id", proJob.id);

  after(async () => {
    try {
      await runDynamicChain(admin, studioJob.id, user.id, {
        topic: seedTopic.slice(0, 2000),
        level: "intermediate",
        length: "medium",
        course_category: category as "certification" | "professional" | "language" | "hobby" | "academic",
      }, "claude-sonnet-4-5");

      // v0.43 skeleton: 영상 합성은 사용자가 /dashboard/history/{studio_job_id}에서 [Cast 영상 만들기] 클릭
      // v0.44+에서 자동 트리거 + 강사 사진/음성 클론 통합 예정
      const note = synthVideo
        ? "studio 보강 완료. 영상 합성은 작업 결과 페이지의 [Cast 영상 만들기] 버튼에서 실행하세요 (v0.44 자동화 예정)."
        : "studio 보강 완료.";
      await admin.from("studio_pro_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error: synthVideo ? note : null,
      }).eq("id", proJob.id);
    } catch (err) {
      await admin.from("studio_pro_jobs").update({
        status: "failed",
        error: `enhance failed: ${err instanceof Error ? err.message : String(err)}`,
      }).eq("id", proJob.id);
    }
  });

  return NextResponse.json({ ok: true, pro_job_id: proJob.id, studio_job_id: studioJob.id });
}
