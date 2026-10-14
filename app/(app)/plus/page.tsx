import { Check, CheckCircle2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { User, PLAN, hasPlus } from "@/lib/models";
import { formatPlanPrice } from "@/lib/plan";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { subscriptionStateFrom, syncSubscriptionFromStripe } from "@/lib/subscription";
import { PlusActions } from "@/components/PlusActions";

export const metadata = { title: "Lectoire Plus" };
export const dynamic = "force-dynamic";

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; locked?: string }>;
}) {
  const session = (await getVerifiedUser())!;
  const { session_id, locked } = await searchParams;
  await connectDB();

  /* Returning from Stripe checkout: activate immediately (webhooks can't
     reach local dev — same pattern as order verification). */
  let justSubscribed = false;
  if (session_id && isStripeConfigured()) {
    try {
      const checkout = await getStripe().checkout.sessions.retrieve(session_id, {
        expand: ["subscription"],
      });
      const sub = checkout.subscription;
      if (
        checkout.mode === "subscription" &&
        sub &&
        typeof sub !== "string" &&
        checkout.metadata?.userId === session.id
      ) {
        await User.updateOne(
          { _id: session.id },
          { $set: { subscription: subscriptionStateFrom(sub) } }
        );
        justSubscribed = sub.status === "active" || sub.status === "trialing";
      }
    } catch {
      /* unknown session — ignore */
    }
  } else if (isStripeConfigured()) {
    // Keep local state honest (renewals/cancellations) without webhooks
    await syncSubscriptionFromStripe(session.id);
  }

  const user = (await User.findById(session.id).select("role subscription"))!;
  const sub = user.subscription;
  const plus = hasPlus(user);
  const isAdmin = user.role === "admin";
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const state: "none" | "active" | "cancelling" | "past_due" =
    sub?.status === "active"
      ? sub.cancelAtPeriodEnd
        ? "cancelling"
        : "active"
      : sub?.status === "past_due"
        ? "past_due"
        : "none";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:px-10">
      <p className="text-center text-[13px] font-semibold tracking-wide text-faint uppercase">
        One plan, everything included
      </p>
      <h1 className="font-display mt-1 text-center text-4xl font-semibold tracking-tight">
        {PLAN.name}
      </h1>

      {locked && (
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          <Lock className="h-5 w-5 shrink-0" />
          {decodeURIComponent(locked) === "studio"
            ? "The AI writing Studio is part of Lectoire Plus — subscribe to start creating books."
            : `“${decodeURIComponent(locked)}” is part of the full store — subscribe to read it and every other book.`}
        </div>
      )}

      {justSubscribed && (
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Welcome to Lectoire Plus! The whole store and the Studio are now yours.
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface shadow-book">
        <div className="border-b border-line bg-gradient-to-br from-accent-soft to-surface px-8 py-7 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white shadow-book-sm">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="font-display text-4xl font-semibold tracking-tight">
            {formatPlanPrice().split("/")[0]}
            <span className="text-lg font-normal text-muted">/{PLAN.interval}</span>
          </p>
          <p className="mt-1 text-sm text-muted">Cancel anytime — keep access to the period end.</p>
        </div>

        <ul className="space-y-3 px-8 py-7">
          {PLAN.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-[15px] leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {f}
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-8 py-6">
          {isAdmin ? (
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted">
              <ShieldCheck className="h-4 w-4 text-accent" />
              You have full access as a company admin — no subscription needed.
            </p>
          ) : (
            <>
              {state === "active" && periodEnd && (
                <p className="mb-3 text-center text-sm text-muted">
                  Your plan is <span className="font-semibold text-emerald-700">active</span> and
                  renews on {periodEnd}.
                </p>
              )}
              {state === "cancelling" && periodEnd && (
                <p className="mb-3 text-center text-sm text-muted">
                  Your plan is cancelled and ends on <span className="font-semibold">{periodEnd}</span>.
                  You keep full access until then.
                </p>
              )}
              {state === "past_due" && (
                <p className="mb-3 text-center text-sm font-medium text-red-600">
                  Your last payment failed — update payment to keep access.
                </p>
              )}
              <PlusActions state={state} />
            </>
          )}
        </div>
      </div>

      {!plus && !isAdmin && (
        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          Without Plus you can still browse the store, read free books, keep your library,
          and order printed copies of any book.
        </p>
      )}
    </div>
  );
}
