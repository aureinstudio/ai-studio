import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPE = new Set(["b2b_customer", "demo", "internal"]);
const VALID_PLAN = new Set(["free", "starter", "pro", "enterprise"]);

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "keg_super_admin") {
    return { error: NextResponse.json({ error: "forbidden — keg_super_admin only" }, { status: 403 }) };
  }
  return { error: null, user };
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;
  const admin = createAdminClient();
  const { data } = await admin.from("tenants").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ tenants: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const { name, slug, tenant_type, plan } = body;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }
  if (!VALID_TYPE.has(tenant_type)) return NextResponse.json({ error: "invalid tenant_type" }, { status: 400 });
  if (!VALID_PLAN.has(plan)) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .insert({
      name: name.toString().slice(0, 100),
      slug: slug.toString().slice(0, 60),
      tenant_type,
      plan,
      status: tenant_type === "demo" ? "trial" : "active",
    })
    .select("id, slug, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
