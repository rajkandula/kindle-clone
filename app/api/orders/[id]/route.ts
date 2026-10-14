import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAdminUser, getVerifiedUser } from "@/lib/auth";
import { Order, ORDER_STATUSES, type OrderStatus } from "@/lib/models";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/** Admin: update an order's status and/or tracking note. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);

  await connectDB();
  const order = await Order.findById(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    typeof body?.status === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(body.status)
  ) {
    order.status = body.status as OrderStatus;
  }
  if (typeof body?.note === "string") {
    order.note = body.note.trim().slice(0, 500);
  }
  await order.save();

  return NextResponse.json({ ok: true, status: order.status, note: order.note });
}

/**
 * Remove an unpaid order (the owner, or an admin). Paid orders can only be
 * cancelled by an admin via PATCH — they represent real money.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await connectDB();
  const order =
    user.role === "admin"
      ? await Order.findById(id)
      : await Order.findOne({ _id: id, userId: user.id });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Only unpaid orders can be removed." },
      { status: 400 }
    );
  }

  if (order.stripeSessionId && isStripeConfigured()) {
    try {
      await getStripe().checkout.sessions.expire(order.stripeSessionId);
    } catch {
      /* already expired — ignore */
    }
  }
  await order.deleteOne();
  return NextResponse.json({ ok: true });
}
