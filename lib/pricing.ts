import type { IBook } from "./models";

/**
 * Print-on-demand pricing. All amounts in USD cents.
 * Simple flat-rate model for launch; swap TAX_RATE for Stripe Tax
 * (automatic per-region rates) before selling widely.
 */
export const PRICING = {
  /** Base cost of printing + binding one copy. */
  basePrint: 500, // $5.00
  /** Per printed page. */
  perPage: 4, // $0.04
  /** Flat delivery fee per order. */
  delivery: 499, // $4.99
  /** Flat sales-tax rate applied to printing + delivery. */
  taxRate: 0.08,
  /** Words per printed page (trade paperback average). */
  wordsPerPage: 275,
  /** Front/back matter pages added to every book. */
  extraPages: 8,
  currency: "usd" as const,
} as const;

export interface OrderPricing {
  pages: number;
  printingPerCopy: number;
  printing: number;
  delivery: number;
  tax: number;
  total: number;
}

export function pagesForBook(book: Pick<IBook, "wordCount">): number {
  return Math.max(24, Math.ceil(book.wordCount / PRICING.wordsPerPage) + PRICING.extraPages);
}

export function computeOrderPricing(
  book: Pick<IBook, "wordCount"> & { sale?: { printPriceCents?: number } },
  quantity: number
): OrderPricing {
  const qty = Math.min(Math.max(Math.round(quantity) || 1, 1), 10);
  const pages = pagesForBook(book);
  const cost = PRICING.basePrint + pages * PRICING.perPage;
  // An author-set list price replaces cost-recovery; the difference is the
  // margin they earn from. Guarded so a stale low price can never sell at a loss.
  const listed = book.sale?.printPriceCents ?? 0;
  const printingPerCopy = listed >= cost + MIN_PRINT_MARGIN_CENTS ? listed : cost;
  const printing = printingPerCopy * qty;
  const delivery = PRICING.delivery;
  const tax = Math.round((printing + delivery) * PRICING.taxRate);
  return { pages, printingPerCopy, printing, delivery, tax, total: printing + delivery + tax };
}

/**
 * The least an author may charge above printing cost.
 *
 * Not an arbitrary floor: below roughly $3 the card fee swallows the platform's
 * share and Lectoire loses money on every copy sold — worst on the cheap books
 * that sell in volume. The author still earns on a $3 margin; we just refuse
 * prices where nobody does.
 */
export const MIN_PRINT_MARGIN_CENTS = 300;

/** Cost to produce one copy — what the list price has to clear. */
export function printCostPerCopy(book: Pick<IBook, "wordCount">): number {
  return PRICING.basePrint + pagesForBook(book) * PRICING.perPage;
}

/** The lowest list price we'll accept for a paperback. */
export function minListPrice(book: Pick<IBook, "wordCount">): number {
  return printCostPerCopy(book) + MIN_PRINT_MARGIN_CENTS;
}

/**
 * How one printed copy divides.
 *
 * Printing is paid at cost, then what's left is split the same 70/30 as a
 * digital sale — one rule to explain instead of two. The card percentage comes
 * off first for the same reason it does on digital: a gross split goes negative
 * on thin margins.
 */
export function printSplit(listCents: number, costCents: number) {
  const margin = Math.max(0, listCents - costCents);
  const fee = Math.round(listCents * 0.029);
  const net = Math.max(0, margin - fee);
  const author = Math.round(net * 0.7);
  return { cost: costCents, margin, fee, net, author, platform: net - author };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
