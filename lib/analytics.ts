/**
 * Numbers for the admin portal.
 *
 * Every figure here is derived from the collections that actually hold the
 * money — no counters kept alongside. Slower to read, but a dashboard that
 * disagrees with the ledger is worse than no dashboard.
 */
import mongoose from "mongoose";
import {
  AuthorAccount,
  Book,
  ContactMessage,
  Order,
  PayoutRecord,
  Purchase,
  User,
  PLAN,
} from "./models";

const PAID_ORDER_STATES = ["paid", "printing", "shipped", "delivered"] as const;

const sumOf = async (
  model: mongoose.Model<never>,
  match: Record<string, unknown>,
  field: string
): Promise<number> => {
  const rows = await (model as unknown as mongoose.Model<unknown>).aggregate<{ sum: number }>([
    { $match: match },
    { $group: { _id: null, sum: { $sum: `$${field}` } } },
  ]);
  return rows[0]?.sum ?? 0;
};

export interface RevenueSummary {
  /** Recurring monthly revenue from active Plus subscriptions. */
  mrrCents: number;
  activeSubs: number;
  pastDueSubs: number;
  canceledSubs: number;
  cancellingSubs: number;
  /** Gross taken on book sales, and Lectoire's share of it. */
  bookGrossCents: number;
  bookPlatformCents: number;
  authorEarnedCents: number;
  /** Print orders, charged in full. */
  printGrossCents: number;
  printOrders: number;
  /** Everything charged to a card, all sources. */
  totalCollectedCents: number;
  /** Owed to authors but not yet sent. */
  authorOwedCents: number;
  paidOutCents: number;
}

export async function revenueSummary(): Promise<RevenueSummary> {
  const [
    activeSubs,
    pastDueSubs,
    canceledSubs,
    cancellingSubs,
    bookGross,
    bookPlatform,
    authorEarned,
    printGross,
    printOrders,
    paidOut,
    owed,
  ] = await Promise.all([
    User.countDocuments({ "subscription.status": "active" }),
    User.countDocuments({ "subscription.status": "past_due" }),
    User.countDocuments({ "subscription.status": "canceled" }),
    User.countDocuments({ "subscription.cancelAtPeriodEnd": true, "subscription.status": "active" }),
    sumOf(Purchase as never, { status: "paid" }, "grossCents"),
    sumOf(Purchase as never, { status: "paid" }, "platformCents"),
    sumOf(Purchase as never, { status: "paid" }, "authorCents"),
    sumOf(Order as never, { status: { $in: PAID_ORDER_STATES } }, "amounts.total"),
    Order.countDocuments({ status: { $in: [...PAID_ORDER_STATES] } }),
    sumOf(PayoutRecord as never, { status: "paid" }, "amountCents"),
    sumOf(AuthorAccount as never, {}, "balanceCents"),
  ]);

  return {
    mrrCents: activeSubs * PLAN.priceCents,
    activeSubs,
    pastDueSubs,
    canceledSubs,
    cancellingSubs,
    bookGrossCents: bookGross,
    bookPlatformCents: bookPlatform,
    authorEarnedCents: authorEarned,
    printGrossCents: printGross,
    printOrders,
    // Subscription history lives in Stripe; this is what our own records hold.
    totalCollectedCents: bookGross + printGross,
    authorOwedCents: owed,
    paidOutCents: paidOut,
  };
}

export interface SubscriberRow {
  id: string;
  name: string;
  username: string;
  status: string;
  renewsAt: string | null;
  cancelling: boolean;
  joinedAt: string;
}

export async function subscribers(limit = 200): Promise<SubscriberRow[]> {
  // Match real states explicitly. `$ne: "none"` also matches users whose
  // subscription field is missing entirely, which listed everyone who had never
  // subscribed as a subscriber.
  const rows = await User.find({
    "subscription.status": { $in: ["active", "past_due", "canceled"] },
  })
    .sort({ "subscription.currentPeriodEnd": -1 })
    .limit(limit)
    .select("name username subscription createdAt");
  return rows.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    username: u.username,
    status: u.subscription?.status ?? "none",
    renewsAt: u.subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelling: Boolean(u.subscription?.cancelAtPeriodEnd),
    joinedAt: u.createdAt.toISOString(),
  }));
}

export interface CreatorRow {
  userId: string;
  name: string;
  username: string;
  booksPublished: number;
  salesCount: number;
  earnedCents: number;
  balanceCents: number;
  paidOutCents: number;
  onboarded: boolean;
  frozen: boolean;
  frozenReason: string;
}

/** Everyone who has earned anything, or set themselves up to. */
export async function creators(): Promise<CreatorRow[]> {
  const [accounts, earnings, bookCounts] = await Promise.all([
    AuthorAccount.find({}).select("userId balanceCents paidOutCents onboarded frozen frozenReason"),
    Purchase.aggregate<{ _id: mongoose.Types.ObjectId; earned: number; sales: number }>([
      { $match: { status: "paid", authorId: { $ne: null } } },
      { $group: { _id: "$authorId", earned: { $sum: "$authorCents" }, sales: { $sum: 1 } } },
    ]),
    Book.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { status: "published", ownerId: { $ne: null } } },
      { $group: { _id: "$ownerId", n: { $sum: 1 } } },
    ]),
  ]);

  const ids = new Set<string>([
    ...accounts.map((a) => a.userId.toString()),
    ...earnings.map((e) => e._id.toString()),
  ]);
  if (ids.size === 0) return [];

  const users = await User.find({ _id: { $in: [...ids] } }).select("name username");
  const byUser = new Map(users.map((u) => [u._id.toString(), u]));
  const earnedBy = new Map(earnings.map((e) => [e._id.toString(), e]));
  const booksBy = new Map(bookCounts.map((b) => [b._id.toString(), b.n]));
  const accountBy = new Map(accounts.map((a) => [a.userId.toString(), a]));

  return [...ids]
    .map((id) => {
      const account = accountBy.get(id);
      const earned = earnedBy.get(id);
      return {
        userId: id,
        name: byUser.get(id)?.name ?? "Unknown",
        username: byUser.get(id)?.username ?? "",
        booksPublished: booksBy.get(id) ?? 0,
        salesCount: earned?.sales ?? 0,
        earnedCents: earned?.earned ?? 0,
        balanceCents: account?.balanceCents ?? 0,
        paidOutCents: account?.paidOutCents ?? 0,
        onboarded: account?.onboarded ?? false,
        frozen: account?.frozen ?? false,
        frozenReason: account?.frozenReason ?? "",
      };
    })
    .sort((a, b) => b.earnedCents - a.earnedCents);
}

export interface BookSalesRow {
  id: string;
  title: string;
  authorName: string;
  status: string;
  priceCents: number;
  printPriceCents: number;
  salesCount: number;
  grossCents: number;
  authorCents: number;
}

/** Every book that has sold, best first — plus priced books that haven't. */
export async function bookSales(limit = 100): Promise<BookSalesRow[]> {
  const sales = await Purchase.aggregate<{
    _id: mongoose.Types.ObjectId;
    sales: number;
    gross: number;
    author: number;
  }>([
    { $match: { status: "paid" } },
    {
      $group: {
        _id: "$bookId",
        sales: { $sum: 1 },
        gross: { $sum: "$grossCents" },
        author: { $sum: "$authorCents" },
      },
    },
    { $sort: { gross: -1 } },
    { $limit: limit },
  ]);

  const soldIds = sales.map((s) => s._id);
  // Priced books with no sales yet matter too — that's the "listed but not
  // selling" case an admin needs to see.
  const listed = await Book.find({ "sale.enabled": true, _id: { $nin: soldIds } })
    .limit(Math.max(0, limit - sales.length))
    .select("title authorName status sale");
  const sold = await Book.find({ _id: { $in: soldIds } }).select("title authorName status sale");
  const byId = new Map([...sold, ...listed].map((b) => [b._id.toString(), b]));

  const rows: BookSalesRow[] = sales.map((s) => {
    const b = byId.get(s._id.toString());
    return {
      id: s._id.toString(),
      title: b?.title ?? "Removed book",
      authorName: b?.authorName ?? "",
      status: b?.status ?? "",
      priceCents: b?.sale?.priceCents ?? 0,
      printPriceCents: b?.sale?.printPriceCents ?? 0,
      salesCount: s.sales,
      grossCents: s.gross,
      authorCents: s.author,
    };
  });

  for (const b of listed) {
    rows.push({
      id: b._id.toString(),
      title: b.title,
      authorName: b.authorName,
      status: b.status,
      priceCents: b.sale?.priceCents ?? 0,
      printPriceCents: b.sale?.printPriceCents ?? 0,
      salesCount: 0,
      grossCents: 0,
      authorCents: 0,
    });
  }
  return rows;
}

export interface Pulse {
  users: number;
  newUsers7d: number;
  publishedBooks: number;
  draftBooks: number;
  booksForSale: number;
  ordersToFulfil: number;
  newMessages: number;
  frozenCreators: number;
}

export async function pulse(): Promise<Pulse> {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [
    users,
    newUsers7d,
    publishedBooks,
    draftBooks,
    booksForSale,
    ordersToFulfil,
    newMessages,
    frozenCreators,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gt: weekAgo } }),
    Book.countDocuments({ status: "published" }),
    Book.countDocuments({ status: "draft" }),
    Book.countDocuments({ "sale.enabled": true }),
    Order.countDocuments({ status: { $in: ["paid", "printing", "shipped"] as const } }),
    ContactMessage.countDocuments({ status: "new" }),
    AuthorAccount.countDocuments({ frozen: true }),
  ]);
  return {
    users,
    newUsers7d,
    publishedBooks,
    draftBooks,
    booksForSale,
    ordersToFulfil,
    newMessages,
    frozenCreators,
  };
}
