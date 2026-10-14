import Link from "next/link";
import { CheckCircle2, Package } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Order, type OrderStatus } from "@/lib/models";
import { formatCents } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { OrderActions } from "@/components/OrderActions";

export const metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  pending_payment: { label: "Awaiting payment", cls: "bg-stone-200 text-stone-700" },
  paid: { label: "Paid — queued for printing", cls: "bg-emerald-100 text-emerald-800" },
  printing: { label: "Printing", cls: "bg-sky-100 text-sky-800" },
  shipped: { label: "Shipped", cls: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Delivered", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { session_id } = await searchParams;
  await connectDB();

  /* Returning from Stripe checkout: verify the session server-side and mark
     the order paid (works even when the webhook can't reach local dev). */
  let justPaid = false;
  if (session_id && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      if (session.payment_status === "paid") {
        const result = await Order.updateOne(
          { stripeSessionId: session.id, userId: user.id, status: "pending_payment" },
          { $set: { status: "paid" } }
        );
        justPaid = result.modifiedCount > 0 || true;
      }
    } catch {
      /* unknown session — ignore */
    }
  }

  /* Unpaid orders older than Stripe's 24h session lifetime are dead carts —
     clean them up rather than showing "Awaiting payment" forever. */
  await Order.deleteMany({
    userId: user.id,
    status: "pending_payment",
    createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">
        Print & delivery
      </p>
      <h1 className="font-display mb-6 text-4xl font-semibold tracking-tight">
        Your orders
      </h1>

      {justPaid && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Payment received — your book is queued for printing. We&apos;ll ship it to
          your address.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-book-sm">
          <Package className="mb-3 h-8 w-8 text-faint" />
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            No orders yet. Open any book in the store and choose
            “Order print copy” to get a real paperback delivered.
          </p>
          <Link
            href="/store"
            className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            Browse the store
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const meta = STATUS_META[o.status];
            return (
              <div
                key={o._id.toString()}
                className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">
                      {o.bookTitle}
                      <span className="ml-2 text-sm font-normal text-muted">
                        × {o.quantity}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-faint">
                      Ordered{" "}
                      {o.createdAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {o.pages} pages · order #{o._id.toString().slice(-6)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <span className="font-bold">{formatCents(o.amounts.total)}</span>
                  </div>
                </div>
                {o.note && (
                  <p className="mt-3 rounded-xl bg-paper px-4 py-2.5 text-sm text-muted">
                    📦 {o.note}
                  </p>
                )}
                {o.status === "pending_payment" && (
                  <OrderActions orderId={o._id.toString()} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
