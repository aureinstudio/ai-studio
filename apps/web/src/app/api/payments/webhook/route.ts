import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, type PlanKey } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Webhook 핸들러.
 * 처리 이벤트:
 *   - checkout.session.completed → subscriptions row 생성
 *   - customer.subscription.updated → status·기간 업데이트
 *   - customer.subscription.deleted → status='canceled'
 *   - invoice.paid → payment_log
 *   - invoice.payment_failed → payment_log + status='past_due'
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const admin = createAdminClient();
  const obj = event.data.object as Record<string, unknown>;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = (obj.metadata as Record<string, string> | undefined)?.user_id;
        const plan = ((obj.metadata as Record<string, string> | undefined)?.plan ?? "b2c_monthly") as PlanKey;
        const stripeCustomerId = obj.customer as string;
        const stripeSubscriptionId = obj.subscription as string;
        if (userId && stripeSubscriptionId) {
          await admin.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan,
            status: "active",
            amount_krw: (obj.amount_total as number) ?? 0,
          }, { onConflict: "stripe_subscription_id" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subId = obj.id as string;
        const status = (obj.status as string) ?? "canceled";
        await admin.from("subscriptions").update({
          status: status as never,
          current_period_start: new Date((obj.current_period_start as number) * 1000).toISOString(),
          current_period_end: new Date((obj.current_period_end as number) * 1000).toISOString(),
          cancel_at_period_end: !!obj.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", subId);
        break;
      }
      case "invoice.paid": {
        const subId = obj.subscription as string;
        const { data: sub } = await admin.from("subscriptions").select("id, user_id").eq("stripe_subscription_id", subId).maybeSingle();
        if (sub) {
          await admin.from("payment_log").insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            stripe_payment_intent_id: obj.payment_intent as string,
            amount_krw: (obj.amount_paid as number) ?? 0,
            status: "succeeded",
            payment_method: "card",
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const subId = obj.subscription as string;
        await admin.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe/webhook]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "handler error" }, { status: 500 });
  }
}
