import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, MIN_PRICE_CENTS, MAX_PRICE_CENTS, splitSale } from "@/lib/models";
import { formatCents, minListPrice, printCostPerCopy, printSplit } from "@/lib/pricing";

/**
 * Set what a book sells for. Author only.
 *
 * A price moves the book out of Lectoire Plus and into the marketplace, so it
 * is validated here as well as in the UI — the editor is not a security
 * boundary.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findOne({ _id: id, ownerId: user.id });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body?.enabled);
  const priceCents = Math.round(Number(body?.priceCents ?? 0));
  const printPriceCents = Math.round(Number(body?.printPriceCents ?? 0));

  if (enabled) {
    if (!Number.isFinite(priceCents) || priceCents < MIN_PRICE_CENTS) {
      return NextResponse.json(
        { error: `The lowest price is $${(MIN_PRICE_CENTS / 100).toFixed(2)}.` },
        { status: 400 }
      );
    }
    if (priceCents > MAX_PRICE_CENTS) {
      return NextResponse.json(
        { error: `The highest price is $${(MAX_PRICE_CENTS / 100).toFixed(2)}.` },
        { status: 400 }
      );
    }
    if (book.flags.free) {
      return NextResponse.json(
        { error: "This book is marked free. Turn that off before selling it." },
        { status: 400 }
      );
    }
  }

  // A paperback price below printing cost would lose money on every copy, so
  // the floor is enforced here as well as in the editor.
  if (printPriceCents > 0) {
    const floor = minListPrice(book);
    if (printPriceCents < floor) {
      return NextResponse.json(
        {
          error: `This book costs ${formatCents(printCostPerCopy(book))} to print, so the lowest paperback price is ${formatCents(floor)}.`,
        },
        { status: 400 }
      );
    }
    if (printPriceCents > 19999) {
      return NextResponse.json({ error: "The highest paperback price is $199.99." }, { status: 400 });
    }
  }

  book.sale = {
    enabled,
    priceCents: enabled ? priceCents : 0,
    printPriceCents,
    currency: "usd",
  };
  await book.save();

  const digital = splitSale(book.sale.priceCents);
  const cost = printCostPerCopy(book);
  const print = printSplit(book.sale.printPriceCents, cost);
  return NextResponse.json({
    enabled: book.sale.enabled,
    priceCents: book.sale.priceCents,
    youEarnCents: digital.author,
    printPriceCents: book.sale.printPriceCents,
    printCostCents: cost,
    minPrintPriceCents: minListPrice(book),
    printYouEarnCents: print.author,
  });
}
