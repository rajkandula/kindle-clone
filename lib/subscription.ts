import type Stripe from "stripe";
import { User, type IUser } from "./models";
import { getStripe } from "./stripe";

/** Map a Stripe subscription onto our stored billing state. */
export function subscriptionStateFrom(sub: Stripe.Subscription) {
  const status: IUser["subscription"]["status"] =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "past_due" || sub.status === "unpaid"
        ? "past_due"
        : "canceled";
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    status,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

/**
 * Pull the latest subscription state from Stripe and persist it.
 * Called from the /plus page so local dev stays correct even when the
 * Stripe webhook can't reach this machine (same pattern as order verification).
 */
export async function syncSubscriptionFromStripe(userId: string): Promise<void> {
  const user = await User.findById(userId).select("subscription");
  const subId = user?.subscription?.stripeSubscriptionId;
  if (!user || !subId) return;
  try {
    const sub = await getStripe().subscriptions.retrieve(subId);
    await User.updateOne({ _id: userId }, { $set: { subscription: subscriptionStateFrom(sub) } });
  } catch {
    /* Stripe unreachable or subscription gone — keep the stored state. */
  }
}
