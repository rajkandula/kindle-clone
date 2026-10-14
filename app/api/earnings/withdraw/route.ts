import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { payoutAuthor } from "@/lib/earnings";

export const maxDuration = 60;

/**
 * Withdraw everything that has cleared.
 *
 * No upper limit: the fraud controls are the 30-day hold and the dispute
 * freeze, both of which act before money becomes payable. Capping withdrawals
 * would only penalise the authors selling the most.
 */
export async function POST() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const outcome = await payoutAuthor(user.id);
  if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: 400 });
  return NextResponse.json({ ok: true, amountCents: outcome.amountCents });
}
