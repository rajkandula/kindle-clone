import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, User } from "@/lib/models";
import { AuthorAccount } from "@/lib/models";
import { handleDispute, recordBookSale, recordPrintSale, reverseSale } from "@/lib/earnings";
import { notifyAdmin } from "@/lib/email";
import { PUBLIC_ORIGIN } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { subscriptionStateFrom } from "@/lib/subscription";

/**
 * Stripe webhook: marks orders paid the moment checkout completes, and keeps
 * Lectoire Plus subscription state in sync (activation, renewal, payment
 * trouble, cancellation). The /orders and /plus success pages also verify
 * sessions directly, so local dev works even without webhook forwarding.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "subscription" && session.subscription) {
      // Plus signup completed — pull the subscription and activate
      const subId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await getStripe().subscriptions.retrieve(subId);
      const userId = session.metadata?.userId ?? sub.metadata?.userId;
      if (userId) {
        await connectDB();
        await User.updateOne(
          { _id: userId },
          { $set: { subscription: subscriptionStateFrom(sub) } }
        );
      }
    } else if (session.metadata?.kind === "book_purchase" && session.payment_status === "paid") {
      await connectDB();
      await recordBookSale(session);
    } else if (session.payment_status === "paid") {
      await connectDB();
      await Order.updateOne(
        { stripeSessionId: session.id, status: "pending_payment" },
        { $set: { status: "paid" } }
      );
      const order = await Order.findOne({ stripeSessionId: session.id });
      if (order) {
        await recordPrintSale(order);
        // Someone has paid for a physical object; it needs a human to fulfil it.
        notifyAdmin(
          "New print order",
          `Order ${order._id} is paid — ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? "usd").toUpperCase()}.\nFulfil it: ${PUBLIC_ORIGIN}/admin/orders`
        );
      }
    }
  }

  if (event.type === "charge.refunded") {
    await connectDB();
    await reverseSale(event.data.object);
  }

  // A dispute means someone is contesting the charge — usually a stolen card.
  if (event.type === "charge.dispute.created") {
    await connectDB();
    const dispute = event.data.object;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
    await handleDispute(await getStripe().charges.retrieve(chargeId));
    // Money is on hold and the author's payouts are frozen — a human should look today.
    notifyAdmin(
      "Card dispute opened",
      `Stripe charge ${chargeId} is disputed (${dispute.reason ?? "no reason given"}). Payouts for the linked author are frozen pending review.\n${PUBLIC_ORIGIN}/admin/creators`
    );
  }

  if (event.type === "account.updated") {
    // Stripe finished (or un-finished) the author's onboarding
    const account = event.data.object;
    await connectDB();
    await AuthorAccount.updateOne(
      { stripeAccountId: account.id },
      { $set: { onboarded: Boolean(account.charges_enabled && account.payouts_enabled) } }
    );
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    await connectDB();
    await User.updateOne(
      { "subscription.stripeSubscriptionId": sub.id },
      { $set: { subscription: subscriptionStateFrom(sub) } }
    );
  }

  return NextResponse.json({ received: true });
}
