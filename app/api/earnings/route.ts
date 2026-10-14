import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { AuthorAccount, MIN_PAYOUT_CENTS, AUTHOR_SHARE } from "@/lib/models";
import { earningsFor, recentSales } from "@/lib/earnings";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { PUBLIC_ORIGIN } from "@/lib/site";

export const maxDuration = 60;

/** What this author has earned, and whether they can be paid yet. */
export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const [summary, sales] = await Promise.all([earningsFor(user.id), recentSales(user.id)]);
  return NextResponse.json({
    ...summary,
    sales,
    authorSharePercent: Math.round(AUTHOR_SHARE * 100),
    minPayoutCents: MIN_PAYOUT_CENTS,
    payoutsAvailable: isStripeConfigured(),
  });
}

/**
 * Begin or resume Stripe Connect onboarding.
 *
 * Express accounts mean Stripe collects the bank details, identity documents
 * and tax forms, and issues the 1099s. Lectoire never sees any of it — which
 * is the entire reason this is a redirect rather than a form.
 */
export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payouts aren't configured yet." }, { status: 503 });
  }

  await connectDB();
  const stripe = getStripe();
  let account = await AuthorAccount.findOne({ userId: user.id });

  try {
    if (!account?.stripeAccountId) {
      const created = await stripe.accounts.create({
        type: "express",
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { userId: user.id },
      });
      account = await AuthorAccount.findOneAndUpdate(
        { userId: user.id },
        {
          $set: { stripeAccountId: created.id },
          $setOnInsert: { balanceCents: 0, lifetimeCents: 0, paidOutCents: 0, onboarded: false },
        },
        { upsert: true, new: true }
      );
    }

    const origin =
      req.headers.get("origin")?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      PUBLIC_ORIGIN;

    const link = await stripe.accountLinks.create({
      account: account!.stripeAccountId,
      // Stripe sends people back here if the link expires mid-flow
      refresh_url: `${origin}/earnings?setup=retry`,
      return_url: `${origin}/earnings?setup=done`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    // Without this the route throws and the browser receives an empty 500,
    // which reads as a broken app rather than a setting nobody switched on.
    const message = err instanceof Error ? err.message : "Stripe rejected that request.";
    console.error("stripe connect onboarding failed:", message);
    const notEnabled = /signed up for Connect|Connect.*not.*enabled/i.test(message);
    return NextResponse.json(
      {
        error: notEnabled
          ? "Payouts need switching on in Stripe first. It's a one-time signup — we'll take you there."
          : `Stripe couldn't start payout setup: ${message}`,
        // A URL the browser can send them to, so the fix is one click rather
        // than a sentence telling them to go and find a page themselves.
        ...(notEnabled
          ? {
              actionUrl: "https://dashboard.stripe.com/connect/overview",
              actionLabel: "Enable Stripe Connect",
            }
          : {}),
      },
      { status: notEnabled ? 503 : 502 }
    );
  }
}
