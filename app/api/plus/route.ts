import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { User, PLAN, hasPlus } from "@/lib/models";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { subscriptionStateFrom } from "@/lib/subscription";

/** Current subscription state for the signed-in user. */
export async function GET() {
  const session = await getVerifiedUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const user = await User.findById(session.id).select("role subscription");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = user.subscription;
  return NextResponse.json({
    plus: hasPlus(user),
    status: s?.status ?? "none",
    cancelAtPeriodEnd: s?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: s?.currentPeriodEnd ?? null,
    admin: user.role === "admin",
  });
}

/** Start a subscription: creates a Stripe Checkout Session (mode: subscription). */
export async function POST(req: Request) {
  const session = await getVerifiedUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  await connectDB();
  const user = await User.findById(session.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.subscription?.status === "active") {
    return NextResponse.json({ error: "You already have Lectoire Plus." }, { status: 400 });
  }

  const stripe = getStripe();

  // Reuse the Stripe customer across attempts so billing history stays in one place
  let customerId = user.subscription?.stripeCustomerId || "";
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if (existing.deleted) customerId = "";
    } catch {
      customerId = "";
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: user.name,
      metadata: { userId: user._id.toString(), username: user.username },
    });
    customerId = customer.id;
    await User.updateOne(
      { _id: user._id },
      { $set: { "subscription.stripeCustomerId": customerId } }
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user._id.toString(),
    metadata: { userId: user._id.toString() },
    subscription_data: { metadata: { userId: user._id.toString() } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PLAN.priceCents,
          recurring: { interval: PLAN.interval },
          product_data: {
            name: PLAN.name,
            description: "Create books with AI and read the entire Lectoire store.",
          },
        },
      },
    ],
    success_url: `${origin}/plus?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/plus`,
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}

/** Cancel at period end — access continues until the paid-through date. */
export async function DELETE() {
  const session = await getVerifiedUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  await connectDB();
  const user = await User.findById(session.id).select("subscription");
  const subId = user?.subscription?.stripeSubscriptionId;
  if (!user || !subId || user.subscription.status !== "active") {
    return NextResponse.json({ error: "No active subscription." }, { status: 400 });
  }

  const sub = await getStripe().subscriptions.update(subId, { cancel_at_period_end: true });
  await User.updateOne(
    { _id: user._id },
    { $set: { subscription: subscriptionStateFrom(sub) } }
  );
  return NextResponse.json({ ok: true });
}

/** Resume a subscription that was set to cancel at period end. */
export async function PATCH() {
  const session = await getVerifiedUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  await connectDB();
  const user = await User.findById(session.id).select("subscription");
  const subId = user?.subscription?.stripeSubscriptionId;
  if (!user || !subId || !user.subscription.cancelAtPeriodEnd) {
    return NextResponse.json({ error: "Nothing to resume." }, { status: 400 });
  }

  const sub = await getStripe().subscriptions.update(subId, { cancel_at_period_end: false });
  await User.updateOne(
    { _id: user._id },
    { $set: { subscription: subscriptionStateFrom(sub) } }
  );
  return NextResponse.json({ ok: true });
}
