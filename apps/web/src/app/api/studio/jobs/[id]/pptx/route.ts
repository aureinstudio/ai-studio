import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePptx } from "@/lib/exporters/pptx-generator";
import { uploadToStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // admin 클라이언트로 조회 (RLS 우회) — 수동 권한 검증으로 보안 유지
  const admin = createAdminClient();
  const { data: job, error: jobErr } = await admin
    .from("studio_jobs")
    .select("id, user_id, topic, level, content, is_sample, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (jobErr) {
    return NextResponse.json(
      { error: "query_failed", detail: jobErr.message },
      { status: 500 },
    );
  }
  if (!job) {
    return NextResponse.json(
      { error: "not_found", message: `Job ID ${id.slice(0, 8)}… 가 존재하지 않습니다.` },
      { status: 404 },
    );
  }
  if (job.deleted_at) {
    return NextResponse.json({ error: "job_deleted" }, { status: 410 });
  }
  // 본인 작업 또는 공개 샘플만 export 허용
  if (job.user_id !== user.id && !job.is_sample) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!job.content) {
    return NextResponse.json({ error: "no_content_yet" }, { status: 400 });
  }

  // 콘텐츠 추출 (v0.6 / v0.9+ / v0.10+ 모두 호환)
  const curator = job.content.curator ?? job.content.team2?.curator;
  const planner = job.content.planner ?? job.content.team2?.planner;
  const planning = job.content.planning;
  const infographics = job.content.team2?.infographics ?? job.content.infographics;

  if (!curator || !planner) {
    return NextResponse.json(
      { error: "incomplete_content", message: "curator 또는 planner 출력이 없습니다." },
      { status: 400 },
    );
  }

  try {
    const buffer = await generatePptx({
      topic: job.topic,
      level: job.level,
      curator,
      planner,
      planning,
      infographics,
    });

    // Storage 키: 매 호출마다 timestamp 추가 — 브라우저·CDN 캐시 회피
    // 디자인 변경 후에도 즉시 새 파일 받을 수 있도록
    const timestamp = Date.now();
    const storagePath = `${job.id}/v${timestamp}.pptx`;
    const displayFilename = `${sanitizeFilename(job.topic)}.pptx`;

    const { url } = await uploadToStorage(
      admin,
      "studio-pptx",
      storagePath,
      buffer,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    return NextResponse.json({
      url,
      filename: displayFilename,
      size_bytes: buffer.length,
      generated_at: new Date(timestamp).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pptx export] failed for job ${id}:`, err);
    return NextResponse.json(
      { error: "pptx_generation_failed", detail: message },
      { status: 500 },
    );
  }
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
