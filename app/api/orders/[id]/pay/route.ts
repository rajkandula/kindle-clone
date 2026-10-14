import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Order } from "@/lib/models";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Resume payment for an unpaid order: returns the existing Stripe Checkout
 * URL if the session is still open, otherwise creates a fresh session for
 * the same order.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const order = await Order.findOne({ _id: id, userId: user.id });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
  }

  const stripe = getStripe();

  // Reuse the original session if it's still open
  if (order.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({ checkoutUrl: existing.url });
      }
      if (existing.payment_status === "paid") {
        order.status = "paid";
        await order.save();
        return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
      }
    } catch {
      /* unknown/expired session — fall through and create a new one */
    }
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const perCopy = Math.round(order.amounts.printing / order.quantity);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: order._id.toString(),
    metadata: { orderId: order._id.toString() },
    line_items: [
      {
        quantity: order.quantity,
        price_data: {
          currency: "usd",
          unit_amount: perCopy,
          product_data: {
            name: `Printed copy: ${order.bookTitle}`,
            description: `${order.pages} pages, paperback · by ${order.bookAuthor}`,
          },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: order.amounts.delivery,
          product_data: { name: "Delivery" },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: order.amounts.tax,
          product_data: { name: "Sales tax" },
        },
      },
    ],
    success_url: `${origin}/orders?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/orders`,
  });

  order.stripeSessionId = session.id;
  await order.save();
  return NextResponse.json({ checkoutUrl: session.url });
}
