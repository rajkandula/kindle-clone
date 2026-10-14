import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { AuthorAccount } from "@/lib/models";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const maxDuration = 60;

/**
 * One-time link into the author's own Stripe dashboard.
 *
 * Where they change their bank account, see when Stripe paid them out, and
 * download tax documents. All of it lives with Stripe by design — Lectoire
 * has no bank details to show or edit.
 */
export async function POST() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payouts aren't configured." }, { status: 503 });
  }

  await connectDB();
  const account = await AuthorAccount.findOne({ userId: user.id });
  if (!account?.stripeAccountId || !account.onboarded) {
    return NextResponse.json({ error: "Finish payout setup first." }, { status: 400 });
  }

  try {
    const link = await getStripe().accounts.createLoginLink(account.stripeAccountId);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe refused the request.";
    console.error("stripe dashboard link failed:", message);
    return NextResponse.json(
      { error: "Couldn't open your Stripe dashboard just now — try again shortly." },
      { status: 502 }
    );
  }
}
