import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/auth/api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }), user: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

export async function GET() {
  const { error, user } = await requireAdmin();
  if (error) return error;
  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("api_keys")
    .select("id, owner_user_id, name, key_prefix, scopes, rate_limit_per_min, monthly_cost_cap_usd, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [], requested_by: user!.id });
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const {
    owner_user_id,
    name,
    scopes = ["studio", "cast", "tutor"],
    rate_limit_per_min = 60,
    monthly_cost_cap_usd = 100,
  } = body as {
    owner_user_id?: string;
    name?: string;
    scopes?: string[];
    rate_limit_per_min?: number;
    monthly_cost_cap_usd?: number;
  };

  if (!owner_user_id || !name) {
    return NextResponse.json({ error: "owner_user_id and name are required" }, { status: 400 });
  }

  const { plaintext, prefix, hash } = generateApiKey();
  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("api_keys")
    .insert({
      owner_user_id,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      rate_limit_per_min,
      monthly_cost_cap_usd,
      created_by: user!.id,
    })
    .select("id, key_prefix, name, created_at")
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // 평문 키는 단 1회만 노출 — 클라이언트가 안전히 저장해야 함
  return NextResponse.json({ ...data, plaintext_key: plaintext, warning: "이 키는 다시 표시되지 않습니다. 즉시 저장하세요." });
}
