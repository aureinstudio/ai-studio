import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  studio_job_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  improvements: z.string().max(1000).nullable().optional(),
  evaluator_name: z.string().max(50).nullable().optional(),
  evaluator_role: z.string().max(80).nullable().optional(),
});

export async function POST(request: NextRequest) {
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

  const supabase = await createClient();

  // 샘플 job인지 확인 — 비-샘플 job에는 평가 제출 차단
  const { data: job } = await supabase
    .from("studio_jobs")
    .select("id, is_sample")
    .eq("id", parsed.data.studio_job_id)
    .eq("is_sample", true)
    .single();

  if (!job) {
    return NextResponse.json(
      { error: "job_not_found_or_not_sample" },
      { status: 404 },
    );
  }

  const { error } = await supabase.from("sme_evaluations").insert({
    studio_job_id: parsed.data.studio_job_id,
    rating: parsed.data.rating,
    improvements: parsed.data.improvements ?? null,
    evaluator_name: parsed.data.evaluator_name ?? null,
    evaluator_role: parsed.data.evaluator_role ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
