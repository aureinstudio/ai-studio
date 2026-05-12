import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  consents: z
    .array(
      z.object({
        consent_type: z.enum(["terms_of_service", "privacy_policy", "beta_consent", "marketing"]),
        version: z.string().min(1).max(80),
        agreed: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
});

/**
 * POST /api/legal/consent
 *
 * 약관 동의 기록 — IP·user_agent 함께 저장. 회원가입 직후 호출.
 */
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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;

  const admin = createAdminClient();
  const rows = parsed.data.consents.map((c) => ({
    user_id: user.id,
    consent_type: c.consent_type,
    version: c.version,
    agreed: c.agreed,
    ip_address: ip,
    user_agent: userAgent,
  }));

  const { error } = await admin.from("consent_log").insert(rows);
  if (error) {
    return NextResponse.json(
      { error: "consent_log_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ recorded: rows.length });
}
