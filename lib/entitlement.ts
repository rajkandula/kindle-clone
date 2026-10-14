/**
 * Who may read a book.
 *
 * One place, because this decides both what a reader sees and whether an author
 * gets paid — and those must never disagree. Before prices existed, Plus
 * unlocked everything; now a priced book has to be bought, and Plus covers the
 * rest of the catalogue.
 */
import { Book, Purchase, isForSale, type IBook, type IUser } from "./models";
import { hasPlus } from "./models";

export type AccessReason =
  | "owner"
  | "free"
  | "purchased"
  | "plus"
  | "needs-purchase"
  | "needs-plus"
  | "unpublished";

export interface Access {
  allowed: boolean;
  reason: AccessReason;
  /** Set when the reader must buy this specific book. */
  priceCents?: number;
}

/**
 * Decide access for one reader and one book.
 *
 * `purchased` is checked before `plus` so that a reader who bought a book keeps
 * it even if their subscription lapses — they bought the book, not a rental.
 */
export async function accessToBook(
  book: Pick<IBook, "_id" | "ownerId" | "status" | "flags" | "sale">,
  user: { id: string; plus: boolean } | null
): Promise<Access> {
  const isOwn = Boolean(user && book.ownerId?.toString() === user.id);
  if (isOwn) return { allowed: true, reason: "owner" };
  if (book.status !== "published") return { allowed: false, reason: "unpublished" };
  if (book.flags?.free) return { allowed: true, reason: "free" };

  if (isForSale(book)) {
    if (!user) return { allowed: false, reason: "needs-purchase", priceCents: book.sale.priceCents };
    const bought = await Purchase.exists({
      bookId: book._id,
      buyerId: user.id,
      status: "paid",
    });
    return bought
      ? { allowed: true, reason: "purchased" }
      : { allowed: false, reason: "needs-purchase", priceCents: book.sale.priceCents };
  }

  // Not for sale — the Plus catalogue
  if (user?.plus) return { allowed: true, reason: "plus" };
  return { allowed: false, reason: "needs-plus" };
}

/** Convenience for routes that only need a yes/no. */
export async function canRead(
  book: Pick<IBook, "_id" | "ownerId" | "status" | "flags" | "sale">,
  user: { id: string; plus: boolean } | null
): Promise<boolean> {
  return (await accessToBook(book, user)).allowed;
}

/** Books this reader has bought, newest first. */
export async function purchasedBookIds(userId: string): Promise<string[]> {
  const rows = await Purchase.find({ buyerId: userId, status: "paid" })
    .select("bookId")
    .sort({ createdAt: -1 });
  return rows.map((r) => r.bookId.toString());
}

/** True when this user already owns a copy. */
export async function hasPurchased(userId: string, bookId: string): Promise<boolean> {
  return Boolean(await Purchase.exists({ buyerId: userId, bookId, status: "paid" }));
}

export { hasPlus, isForSale, Book, type IUser };
