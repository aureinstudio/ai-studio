import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDynamicChain } from "@/lib/agents/orchestrator-dynamic";
import { runCastFullChain } from "@/lib/agents/cast/orchestrator-full";
import { detectSourceType, extractText } from "@/lib/studio-pro/extract-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20MB (pdf/pptx 대응)
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

  // 확장자 화이트리스트 (.md, .txt, .pdf, .pptx)
  const sourceType = detectSourceType(file.name);
  if (!sourceType) {
    return NextResponse.json({ error: "supported: .md / .txt / .pdf / .pptx" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) studio_pro_jobs row
  const { data: proJob, error: insErr } = await admin
    .from("studio_pro_jobs")
    .insert({
      instructor_id: user.id,
      title,
      source_file_type: sourceType,
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

  // 3) 텍스트 추출 (md/txt/pdf/pptx)
  let extracted = "";
  try {
    extracted = await extractText(bytes, sourceType);
  } catch (e) {
    await admin.from("studio_pro_jobs").update({
      status: "failed",
      error: `extraction failed (${sourceType}): ${e instanceof Error ? e.message : String(e)}`,
    }).eq("id", proJob.id);
    return NextResponse.json({ error: `extraction failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 400 });
  }
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

      if (!synthVideo) {
        await admin.from("studio_pro_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", proJob.id);
        return;
      }

      // v0.47: Cast 자동 트리거 — 강사 자산이 등록되어 있으면 본인 얼굴/목소리 사용
      await admin.from("studio_pro_jobs").update({ status: "synthesizing_video" }).eq("id", proJob.id);

      // Studio 결과에서 slides 추출
      const { data: completedStudio } = await admin
        .from("studio_jobs")
        .select("topic, content")
        .eq("id", studioJob.id)
        .single();

      const slides = (completedStudio?.content as {
        planner?: { slides?: unknown[] };
        team2?: { planner?: { slides?: unknown[] } };
      } | null)?.planner?.slides
        ?? (completedStudio?.content as { team2?: { planner?: { slides?: unknown[] } } } | null)?.team2?.planner?.slides
        ?? [];

      if (slides.length === 0) {
        await admin.from("studio_pro_jobs").update({
          status: "failed",
          error: "studio 완료됐으나 slides 미생성 — cast 트리거 불가",
        }).eq("id", proJob.id);
        return;
      }

      // 강사 자산 조회 (talking_photo_id + voice_id)
      const { data: assets } = await admin
        .from("instructor_assets")
        .select("heygen_talking_photo_id, heygen_voice_id")
        .eq("instructor_id", user.id)
        .maybeSingle();

      const hasOwnFace = !!assets?.heygen_talking_photo_id;
      const hasOwnVoice = !!assets?.heygen_voice_id;
      const avatarId = assets?.heygen_talking_photo_id ?? "Anna_public_3_20240108";
      const voiceId = assets?.heygen_voice_id ?? "bef4755ca1f442359c2fe6420690c8f7";
      const avatarType: "avatar" | "talking_photo" = hasOwnFace ? "talking_photo" : "avatar";

      // cast_jobs 생성
      const { data: castJob, error: cjErr } = await admin
        .from("cast_jobs")
        .insert({
          user_id: user.id,
          studio_job_id: studioJob.id,
          mode: "full",
          input_slides: slides,
          status: "pending",
          agent_logs: [],
          approved: true,
        })
        .select("id")
        .single();

      if (cjErr || !castJob) {
        await admin.from("studio_pro_jobs").update({
          status: "failed",
          error: `cast_job insert: ${cjErr?.message}`,
        }).eq("id", proJob.id);
        return;
      }

      await admin.from("studio_pro_jobs").update({ cast_job_id: castJob.id }).eq("id", proJob.id);

      // Webhook URL
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ai-studio-drab-nine.vercel.app");
      const webhookUrl = `${baseUrl}/api/cast/webhooks/heygen`;

      try {
        await runCastFullChain(
          admin,
          castJob.id,
          user.id,
          completedStudio?.topic ?? title,
          slides as never,
          category === "certification",
          "claude-sonnet-4-5",
          avatarId,
          "heygen",
          voiceId,
          webhookUrl,
          avatarType,
        );
        await admin.from("studio_pro_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error: hasOwnFace && hasOwnVoice
            ? null
            : `완료. 본인 자산 미등록 → ${hasOwnFace ? "" : "얼굴 "}${hasOwnVoice ? "" : "음성 "}기본 사용. /instructor/assets에서 등록 시 다음부터 본인 자산 적용.`,
        }).eq("id", proJob.id);
      } catch (castErr) {
        await admin.from("studio_pro_jobs").update({
          status: "failed",
          error: `cast pipeline: ${castErr instanceof Error ? castErr.message : String(castErr)}`,
        }).eq("id", proJob.id);
      }
    } catch (err) {
      await admin.from("studio_pro_jobs").update({
        status: "failed",
        error: `enhance failed: ${err instanceof Error ? err.message : String(err)}`,
      }).eq("id", proJob.id);
    }
  });

  return NextResponse.json({ ok: true, pro_job_id: proJob.id, studio_job_id: studioJob.id });
}
