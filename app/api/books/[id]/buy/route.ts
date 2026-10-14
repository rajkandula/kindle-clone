import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, isForSale, splitSale } from "@/lib/models";
import { hasPurchased } from "@/lib/entitlement";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { PUBLIC_ORIGIN } from "@/lib/site";

export const maxDuration = 60;

/**
 * Start a checkout for one book.
 *
 * The price is read from the book here rather than trusted from the client —
 * a posted price would let anyone buy a novel for a penny.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const book = await Book.findById(id);
  if (!book || book.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isForSale(book)) {
    return NextResponse.json({ error: "This book isn't for sale." }, { status: 400 });
  }
  if (book.ownerId?.toString() === user.id) {
    // Buying your own book would farm card fees and prove nothing.
    return NextResponse.json({ error: "This is your own book." }, { status: 400 });
  }
  if (await hasPurchased(user.id, id)) {
    return NextResponse.json({ error: "You already own this book.", owned: true }, { status: 400 });
  }

  const origin =
    req.headers.get("origin")?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    PUBLIC_ORIGIN;

  const split = splitSale(book.sale.priceCents);
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: book.sale.currency || "usd",
            unit_amount: book.sale.priceCents,
            product_data: {
              name: book.title,
              description: `by ${book.authorName}`,
              ...(book.coverUrl ? { images: [book.coverUrl] } : {}),
            },
          },
        },
      ],
      success_url: `${origin}/read/${book._id}?purchased=1`,
      cancel_url: `${origin}/store/${book._id}`,
      // Everything the webhook needs to credit the right author
      metadata: {
        kind: "book_purchase",
        bookId: book._id.toString(),
        buyerId: user.id,
        authorId: book.ownerId?.toString() ?? "",
        authorCents: String(split.author),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe can refuse for reasons the reader can do nothing about. Say so in
    // JSON — an empty 500 crashes the page and loses the sale twice over.
    const message = err instanceof Error ? err.message : "Stripe couldn't start checkout.";
    console.error("book checkout failed:", message);
    return NextResponse.json(
      { error: "Checkout couldn't be started just now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
