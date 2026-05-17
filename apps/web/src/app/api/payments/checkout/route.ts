import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, PLANS, type PlanKey } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = body.plan as PlanKey;
  if (!plan || !(plan in PLANS)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const session = await createCheckoutSession({
      plan,
      userId: user.id,
      userEmail: user.email ?? "",
      successUrl: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/payments/cancel`,
    });
    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "stripe error" }, { status: 500 });
  }
}
