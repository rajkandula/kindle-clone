import { connectDB } from "@/lib/db";
import {
  Order,
  ORDER_STATUSES,
  User,
  type IUser,
  type OrderStatus,
} from "@/lib/models";
import { OrderAdminCard } from "@/components/OrderAdminCard";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  await connectDB();

  const ACTIVE: OrderStatus[] = ["paid", "printing", "shipped"];
  let filter: Record<string, unknown> = {};
  if (status === "active" || !status) {
    filter = { status: { $in: ACTIVE } };
  } else if (
    status !== "all" &&
    (ORDER_STATUSES as readonly string[]).includes(status)
  ) {
    filter = { status };
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);

  const users = await User.find({
    _id: { $in: orders.map((o) => o.userId) },
  }).select("name username");
  const byId = new Map<string, IUser>(users.map((u) => [u._id.toString(), u]));

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {[
          { key: "active", label: "To fulfil" },
          { key: "all", label: "All" },
          { key: "pending_payment", label: "Awaiting payment" },
          { key: "delivered", label: "Delivered" },
          { key: "cancelled", label: "Cancelled" },
        ].map((f) => (
          <a
            key={f.key}
            href={`/admin/orders?status=${f.key}`}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              (status ?? "active") === f.key
                ? "bg-ink text-white"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-muted">
          Nothing here.
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const customer = byId.get(o.userId.toString());
            return (
              <OrderAdminCard
                key={o._id.toString()}
                order={{
                  id: o._id.toString(),
                  bookId: o.bookId.toString(),
                  bookTitle: o.bookTitle,
                  bookAuthor: o.bookAuthor,
                  quantity: o.quantity,
                  pages: o.pages,
                  amounts: {
                    printing: o.amounts.printing,
                    delivery: o.amounts.delivery,
                    tax: o.amounts.tax,
                    total: o.amounts.total,
                  },
                  status: o.status,
                  note: o.note,
                  createdAt: o.createdAt.toISOString(),
                  customer: customer
                    ? `${customer.name} (@${customer.username})`
                    : "unknown user",
                  address: {
                    name: o.address.name,
                    phone: o.address.phone,
                    line1: o.address.line1,
                    line2: o.address.line2,
                    city: o.address.city,
                    state: o.address.state,
                    postalCode: o.address.postalCode,
                    country: o.address.country,
                  },
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
