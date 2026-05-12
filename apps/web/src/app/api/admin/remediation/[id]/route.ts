import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["dismiss", "ack"]),
  note: z.string().max(500).optional(),
});

/**
 * PATCH /api/admin/remediation/{id}
 * action='dismiss' — 큐에서 보류 처리 (status='dismissed')
 * action='ack' — Studio에서 재생성 완료된 새 job_id 마킹 (status='regenerated')
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.action === "dismiss") {
    await admin
      .from("content_remediation_queue")
      .update({
        status: "dismissed",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ack 자리: 별도 PATCH route로 new_studio_job_id 매핑하는 흐름은 후속(/studio/generate 통합 시).
  return NextResponse.json({ ok: true });
}
