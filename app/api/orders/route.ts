import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, Order, User } from "@/lib/models";
import { computeOrderPricing } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { parseAddress } from "@/lib/address";

/**
 * Place a print order. Body: { bookId, quantity, address }.
 * Creates the order (pending_payment) + a Stripe Checkout session and
 * returns the hosted checkout URL to redirect the customer to.
 */
export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const quantity = Math.min(Math.max(Math.round(Number(body?.quantity)) || 1, 1), 10);
  const address = parseAddress(body?.address);

  if (!mongoose.isValidObjectId(bookId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json(
      { error: "Delivery address needs at least name, street, city, postal code, and country." },
      { status: 400 }
    );
  }

  await connectDB();
  const book = await Book.findById(bookId);
  const isOwn = book?.ownerId?.toString() === user.id;
  if (!book || (book.status !== "published" && !isOwn)) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (book.chapterCount === 0) {
    return NextResponse.json({ error: "This book has no content to print." }, { status: 400 });
  }

  /* Supersede older unpaid attempts for the same book — otherwise every
     abandoned checkout leaves a stray "Awaiting payment" order behind. */
  const stale = await Order.find({
    userId: user.id,
    bookId: book._id,
    status: "pending_payment",
  });
  for (const old of stale) {
    if (old.stripeSessionId) {
      try {
        await getStripe().checkout.sessions.expire(old.stripeSessionId);
      } catch {
        /* already expired or paid — ignore */
      }
    }
    await old.deleteOne();
  }

  const pricing = computeOrderPricing(book, quantity);

  const order = await Order.create({
    userId: user.id,
    bookId: book._id,
    bookTitle: book.title,
    bookAuthor: book.authorName,
    quantity,
    pages: pricing.pages,
    address,
    amounts: {
      printing: pricing.printing,
      delivery: pricing.delivery,
      tax: pricing.tax,
      total: pricing.total,
    },
    status: "pending_payment",
  });

  // Remember the address for next time
  await User.updateOne({ _id: user.id }, { $set: { savedAddress: address } });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString() },
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: pricing.printingPerCopy,
            product_data: {
              name: `Printed copy: ${book.title}`,
              description: `${pricing.pages} pages, paperback · by ${book.authorName}`,
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pricing.delivery,
            product_data: { name: "Delivery" },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pricing.tax,
            product_data: { name: "Sales tax" },
          },
        },
      ],
      success_url: `${origin}/orders?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order/${book._id}?cancelled=1`,
    });

    order.stripeSessionId = session.id;
    await order.save();
    return NextResponse.json({ checkoutUrl: session.url, orderId: order._id.toString() });
  } catch (err) {
    await order.deleteOne();
    console.error("stripe checkout error:", err);
    return NextResponse.json(
      { error: "Could not start checkout — try again." },
      { status: 502 }
    );
  }
}

/** List the current user's orders (admins see all orders via /admin). */
export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50);
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o._id.toString(),
      bookTitle: o.bookTitle,
      quantity: o.quantity,
      total: o.amounts.total,
      status: o.status,
      note: o.note,
      createdAt: o.createdAt,
    })),
  });
}
