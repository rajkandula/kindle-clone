/**
 * Recording sales and moving money to authors.
 *
 * The Purchase collection is the ledger: one immutable row per sale. A refund
 * flips its status and reverses the author's balance rather than deleting the
 * row, so the history always explains the balance.
 */
import type Stripe from "stripe";
import mongoose from "mongoose";
import {
  AuthorAccount,
  Book,
  PayoutRecord,
  Purchase,
  MIN_PAYOUT_CENTS,
  splitSale,
} from "./models";
import { getStripe } from "./stripe";
import { LibraryEntry, User } from "./models";
import { MIN_PRINT_MARGIN_CENTS, printCostPerCopy, printSplit } from "./pricing";
import { HOLD_DAYS, holdCutoff } from "./models";

/**
 * Write a completed sale and credit the author.
 *
 * Idempotent on the Stripe session id: webhooks are delivered at least once, and
 * paying an author twice for one sale is much worse than doing nothing.
 */
export async function recordBookSale(session: Stripe.Checkout.Session): Promise<void> {
  const { bookId, buyerId, authorId } = session.metadata ?? {};
  if (!bookId || !buyerId) return;

  const existing = await Purchase.findOne({ stripeSessionId: session.id });
  if (existing) return;

  const gross = session.amount_total ?? 0;
  const split = splitSale(gross);

  try {
    await Purchase.create({
      bookId,
      buyerId,
      authorId: authorId || null,
      grossCents: split.gross,
      feeCents: split.fee,
      netCents: split.net,
      authorCents: split.author,
      platformCents: split.platform,
      currency: session.currency ?? "usd",
      stripeSessionId: session.id,
      status: "paid",
    });
  } catch (err) {
    // Unique index tripped by a racing duplicate delivery — already recorded.
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }

  if (authorId) {
    await AuthorAccount.updateOne(
      { userId: authorId },
      { $setOnInsert: { stripeAccountId: "", onboarded: false, paidOutCents: 0 } },
      { upsert: true }
    );
    // Balances are derived from the ledger, so there is nothing to increment —
    // but this is the moment to check the sale doesn't look staged.
    await screenForAbuse(authorId, buyerId);
  }

  // Put it on their shelf. Someone who just paid for a book should find it
  // waiting in their library, not have to search the store for it again.
  await LibraryEntry.updateOne(
    { userId: buyerId, bookId },
    { $set: { inLibrary: true } },
    { upsert: true }
  );
}

/**
 * A card dispute: reverse the sale and stop paying that author until reviewed.
 *
 * Disputes are the signature of card fraud, not buyer's remorse. Freezing on
 * the first one is deliberate — the same person will usually have several sales
 * in flight, and paying those out is exactly how a marketplace loses money.
 */
export async function handleDispute(charge: Stripe.Charge): Promise<void> {
  const purchase = await purchaseForCharge(charge);
  if (!purchase) return;

  purchase.status = "disputed";
  await purchase.save();

  if (purchase.authorId) {
    await freezeAuthor(
      purchase.authorId.toString(),
      "A card payment for one of your books was disputed. Payouts are paused while we review it."
    );
  }
}

/** Find the purchase behind a charge, via its checkout session. */
async function purchaseForCharge(charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return null;
  const sessions = await getStripe().checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
  const sessionId = sessions.data[0]?.id;
  if (!sessionId) return null;
  return Purchase.findOne({ stripeSessionId: sessionId, status: { $ne: "refunded" } });
}

/** Reverse a refunded sale: the buyer loses access, the author loses the credit. */
export async function reverseSale(charge: Stripe.Charge): Promise<void> {
  const purchase = await purchaseForCharge(charge);
  if (!purchase || purchase.status !== "paid") return;

  // The row stops counting toward earnings the moment it leaves "paid" —
  // no compensating balance write, so the two can never disagree.
  purchase.status = "refunded";
  purchase.refundedAt = new Date();
  await purchase.save();
}

export interface EarningsSummary {
  /** Settled and payable now. */
  availableCents: number;
  /** Earned but still inside the hold period. */
  pendingCents: number;
  lifetimeCents: number;
  paidOutCents: number;
  onboarded: boolean;
  hasAccount: boolean;
  frozen: boolean;
  frozenReason: string;
  salesCount: number;
  holdDays: number;
}

/**
 * What an author has earned, computed from the ledger rather than a counter.
 *
 * Deriving it means a refund or dispute needs no compensating write to stay
 * correct — the row simply stops counting. A stored balance can drift from the
 * transactions that produced it; a derived one cannot.
 */
export async function earningsFor(userId: string): Promise<EarningsSummary> {
  const cutoff = holdCutoff();
  const [totals, account, paidOut, salesCount] = await Promise.all([
    Purchase.aggregate<{ _id: boolean; sum: number }>([
      { $match: { authorId: new mongoose.Types.ObjectId(userId), status: "paid" } },
      { $group: { _id: { $lte: ["$createdAt", cutoff] }, sum: { $sum: "$authorCents" } } },
    ]),
    AuthorAccount.findOne({ userId }),
    // Money already sent, plus anything mid-flight, so it can't be paid twice
    PayoutRecord.aggregate<{ sum: number }>([
      {
        $match: {
          authorId: new mongoose.Types.ObjectId(userId),
          status: { $in: ["paid", "pending"] },
        },
      },
      { $group: { _id: null, sum: { $sum: "$amountCents" } } },
    ]),
    Purchase.countDocuments({ authorId: userId, status: "paid" }),
  ]);

  const settled = totals.find((t) => t._id === true)?.sum ?? 0;
  const pending = totals.find((t) => t._id === false)?.sum ?? 0;
  const sent = paidOut[0]?.sum ?? 0;

  return {
    availableCents: settled - sent,
    pendingCents: pending,
    lifetimeCents: settled + pending,
    paidOutCents: sent,
    onboarded: account?.onboarded ?? false,
    hasAccount: Boolean(account?.stripeAccountId),
    frozen: account?.frozen ?? false,
    frozenReason: account?.frozenReason ?? "",
    salesCount,
    holdDays: HOLD_DAYS,
  };
}

/** Stop paying an account until a human has looked at it. */
export async function freezeAuthor(userId: string, reason: string): Promise<void> {
  await AuthorAccount.updateOne(
    { userId },
    { $set: { frozen: true, frozenReason: reason } },
    { upsert: true }
  );
}

export async function payoutAuthor(userId: string): Promise<
  { ok: true; amountCents: number } | { ok: false; reason: string }
> {
  const account = await AuthorAccount.findOne({ userId });
  if (!account?.stripeAccountId || !account.onboarded) {
    return { ok: false, reason: "This author hasn't finished payout setup." };
  }
  if (account.frozen) {
    return { ok: false, reason: account.frozenReason || "This account is under review." };
  }

  // Only money past the hold period, less anything already sent or in flight.
  const summary = await earningsFor(userId);
  const amount = summary.availableCents;
  if (amount < MIN_PAYOUT_CENTS) {
    return {
      ok: false,
      reason: `Balance is below the $${(MIN_PAYOUT_CENTS / 100).toFixed(2)} minimum.`,
    };
  }

  // Record the intent BEFORE any money or balance moves. Its id is the
  // idempotency key, so every retry of this payout is the same request to
  // Stripe and can only ever move the money once.
  const record = await PayoutRecord.create({
    authorId: userId,
    amountCents: amount,
    status: "pending",
  });

  // No balance to decrement — the pending PayoutRecord itself removes this
  // money from `available` on the next read, so a crash cannot lose it.
  return sendPayout(record._id.toString(), userId, amount, account.stripeAccountId);
}

/**
 * Perform the transfer for an already-recorded intent.
 *
 * Split out so an interrupted payout can be finished later with the same
 * idempotency key: if the transfer already reached Stripe, Stripe returns the
 * original rather than making a second one.
 */
async function sendPayout(
  recordId: string,
  userId: string,
  amount: number,
  destination: string
): Promise<{ ok: true; amountCents: number } | { ok: false; reason: string }> {
  try {
    const transfer = await getStripe().transfers.create(
      {
        amount,
        currency: "usd",
        destination,
        metadata: { userId, payoutId: recordId },
      },
      { idempotencyKey: `emberleaf_payout_${recordId}` }
    );
    await PayoutRecord.updateOne(
      { _id: recordId },
      { $set: { status: "paid", stripeTransferId: transfer.id, error: "" } }
    );
    return { ok: true, amountCents: amount };
  } catch (err) {
    // Marking it failed returns the money to `available` automatically.
    const message = err instanceof Error ? err.message : "Transfer failed.";
    await PayoutRecord.updateOne({ _id: recordId }, { $set: { status: "failed", error: message } });
    return { ok: false, reason: message };
  }
}

/**
 * Finish payouts that were interrupted between recording and transferring.
 *
 * Safe to run any time: the idempotency key means a transfer that already
 * happened is not repeated, and one that never happened is completed.
 */
export async function resumePendingPayouts(): Promise<number> {
  const stuck = await PayoutRecord.find({ status: "pending" }).sort({ createdAt: 1 }).limit(50);
  let resumed = 0;
  for (const record of stuck) {
    const account = await AuthorAccount.findOne({ userId: record.authorId });
    if (!account?.stripeAccountId) continue;
    const outcome = await sendPayout(
      record._id.toString(),
      record.authorId.toString(),
      record.amountCents,
      account.stripeAccountId
    );
    if (outcome.ok) resumed++;
  }
  return resumed;
}

/** Authors with a payable balance — used by the admin payout run. */
export async function payableAuthors(): Promise<
  { userId: mongoose.Types.ObjectId; balanceCents: number }[]
> {
  const rows = await AuthorAccount.find({
    onboarded: true,
    balanceCents: { $gte: MIN_PAYOUT_CENTS },
  }).select("userId balanceCents");
  return rows.map((r) => ({ userId: r.userId, balanceCents: r.balanceCents }));
}

/** Sales of this author's books, newest first. */
export async function recentSales(userId: string, limit = 50) {
  const sales = await Purchase.find({ authorId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("bookId grossCents authorCents status createdAt");
  const books = await Book.find({ _id: { $in: sales.map((s) => s.bookId) } }).select("title");
  const titles = new Map(books.map((b) => [b._id.toString(), b.title]));
  return sales.map((s) => ({
    id: s._id.toString(),
    title: titles.get(s.bookId.toString()) ?? "Removed book",
    grossCents: s.grossCents,
    authorCents: s.authorCents,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));
}

/**
 * Credit an author for a printed copy.
 *
 * Print earns on the margin above production cost, split the same 70/30 as a
 * digital sale. Recorded as a Purchase so it clears through the same hold and
 * is reversed by the same dispute path — one ledger, not two.
 */
export async function recordPrintSale(order: {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  quantity: number;
  stripeSessionId: string;
}): Promise<void> {
  const book = await Book.findById(order.bookId).select("ownerId wordCount sale");
  if (!book?.ownerId) return;

  const listed = book.sale?.printPriceCents ?? 0;
  const cost = printCostPerCopy(book);
  if (listed < cost + MIN_PRINT_MARGIN_CENTS) return; // sold at cost — nothing to share

  const per = printSplit(listed, cost);
  const qty = Math.max(1, order.quantity);
  const sessionKey = `${order.stripeSessionId || order._id.toString()}_print`;

  try {
    await Purchase.create({
      bookId: book._id,
      buyerId: order.userId,
      authorId: book.ownerId,
      grossCents: listed * qty,
      feeCents: per.fee * qty,
      netCents: per.net * qty,
      authorCents: per.author * qty,
      platformCents: per.platform * qty,
      currency: "usd",
      stripeSessionId: sessionKey,
      status: "paid",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }
}

/**
 * Look for the shapes fraud makes, after each sale.
 *
 * None of these prove anything on their own — a genuine launch day looks a lot
 * like a wash-trading burst. So they freeze payouts for review rather than
 * blocking sales or accusing anyone: the money simply waits for a human.
 */
export async function screenForAbuse(authorId: string, buyerId: string): Promise<void> {
  const [buyer, dayAgo] = [await User.findById(buyerId).select("createdAt"), new Date(Date.now() - 864e5)];

  // 1. A buyer account created minutes before buying is the classic sock puppet.
  if (buyer && buyer.createdAt > new Date(Date.now() - 60 * 60_000)) {
    const fromFreshAccounts = await Purchase.countDocuments({
      authorId,
      status: "paid",
      createdAt: { $gt: dayAgo },
    });
    if (fromFreshAccounts >= 3) {
      await freezeAuthor(
        authorId,
        "Several sales came from brand-new accounts. Payouts are paused while we take a look."
      );
      return;
    }
  }

  // 2. The same buyer bulk-buying one author's catalogue.
  const fromThisBuyer = await Purchase.countDocuments({
    authorId,
    buyerId,
    status: "paid",
    createdAt: { $gt: dayAgo },
  });
  if (fromThisBuyer >= 5) {
    await freezeAuthor(
      authorId,
      "One reader bought an unusual number of your books at once. Payouts are paused while we check."
    );
    return;
  }

  // 3. A sudden burst against a brand-new author account.
  const [author, salesToday] = await Promise.all([
    User.findById(authorId).select("createdAt"),
    Purchase.countDocuments({ authorId, status: "paid", createdAt: { $gt: dayAgo } }),
  ]);
  if (author && author.createdAt > new Date(Date.now() - 7 * 864e5) && salesToday >= 10) {
    await freezeAuthor(
      authorId,
      "A large number of sales landed on a very new account. Payouts are paused while we verify them."
    );
  }
}
