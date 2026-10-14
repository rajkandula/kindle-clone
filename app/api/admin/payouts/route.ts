import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { AuthorAccount, User } from "@/lib/models";
import { payableAuthors, payoutAuthor } from "@/lib/earnings";

export const maxDuration = 300;

/** Who is owed money right now. */
export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const me = await User.findById(user.id).select("role");
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const due = await payableAuthors();
  const names = await User.find({ _id: { $in: due.map((d) => d.userId) } }).select("name username");
  const byId = new Map(names.map((n) => [n._id.toString(), n]));

  // Frozen accounts are the ones needing a decision, so surface them here too
  const held = await AuthorAccount.find({ frozen: true }).select("userId frozenReason");
  const heldNames = await User.find({ _id: { $in: held.map((h) => h.userId) } }).select("name username");
  const heldById = new Map(heldNames.map((n) => [n._id.toString(), n]));

  return NextResponse.json({
    frozen: held.map((h) => ({
      userId: h.userId.toString(),
      name: heldById.get(h.userId.toString())?.name ?? "Unknown",
      username: heldById.get(h.userId.toString())?.username ?? "",
      reason: h.frozenReason,
    })),
    due: due.map((d) => ({
      userId: d.userId.toString(),
      name: byId.get(d.userId.toString())?.name ?? "Unknown",
      username: byId.get(d.userId.toString())?.username ?? "",
      balanceCents: d.balanceCents,
    })),
    totalCents: due.reduce((sum, d) => sum + d.balanceCents, 0),
  });
}

/**
 * Release an account frozen by the abuse screen, or freeze one by hand.
 *
 * The screen freezes on suspicion, which means honest authors will sometimes be
 * caught — a real launch day looks a lot like wash trading. Without this, a
 * false positive would lock someone out of their money permanently.
 */
export async function PATCH(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const me = await User.findById(user.id).select("role");
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const frozen = Boolean(body?.frozen);
  await AuthorAccount.updateOne(
    { userId: targetId },
    {
      $set: {
        frozen,
        frozenReason: frozen ? String(body?.reason ?? "Under review.") : "",
      },
    }
  );
  return NextResponse.json({ ok: true, userId: targetId, frozen });
}

/**
 * Run the payouts.
 *
 * Sequential on purpose — each transfer moves real money, and a partial failure
 * mid-run should leave every other author's balance untouched and retryable.
 */
export async function POST() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const me = await User.findById(user.id).select("role");
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const due = await payableAuthors();
  const results = [];
  for (const author of due) {
    const outcome = await payoutAuthor(author.userId.toString());
    results.push({ userId: author.userId.toString(), ...outcome });
  }
  const paid = results.filter((r) => r.ok);
  return NextResponse.json({
    attempted: results.length,
    paid: paid.length,
    totalPaidCents: paid.reduce((s, r) => s + ("amountCents" in r ? r.amountCents : 0), 0),
    results,
  });
}
