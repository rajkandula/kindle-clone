import Link from "next/link";
import { Gem, MapPin, Package, Plug, Shield } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, LibraryEntry, Order, User, type OrderStatus } from "@/lib/models";
import { formatCents } from "@/lib/pricing";
import { NameEditor, AddressEditor } from "@/components/ProfileEditors";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function ProfilePage() {
  const user = (await getVerifiedUser())!;
  await connectDB();

  const [userDoc, booksCreated, booksPublished, finished, orderCount, recentOrders] =
    await Promise.all([
      User.findById(user.id).select("savedAddress createdAt subscription"),
      Book.countDocuments({ ownerId: user.id }),
      Book.countDocuments({ ownerId: user.id, status: "published" }),
      LibraryEntry.countDocuments({ userId: user.id, finished: true }),
      Order.countDocuments({ userId: user.id }),
      Order.find({ userId: user.id }).sort({ createdAt: -1 }).limit(3),
    ]);

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const stats = [
    { label: "Books created", value: booksCreated },
    { label: "Published", value: booksPublished },
    { label: "Books finished", value: finished },
    { label: "Print orders", value: orderCount },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">
        Account
      </p>
      <h1 className="font-display mb-8 text-4xl font-semibold tracking-tight">Profile</h1>

      {/* Identity */}
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent-soft text-xl font-bold text-accent-deep">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display truncate text-2xl font-semibold">{user.name}</h2>
            <NameEditor initialName={user.name} />
            {user.role === "admin" && (
              <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-deep">
                <Shield className="h-3 w-3" /> Company admin
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            @{user.username} · member since{" "}
            {userDoc?.createdAt.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Membership */}
      <Link
        href="/plus"
        className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-book-sm transition-shadow hover:shadow-book"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft">
            <Gem className="h-4.5 w-4.5 text-accent-deep" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Lectoire Plus</span>
            <span className="block text-xs text-muted">
              {user.role === "admin"
                ? "Full access as company admin"
                : user.plus
                  ? userDoc?.subscription?.cancelAtPeriodEnd
                    ? "Active — ends at period close"
                    : "Active subscription"
                  : "Not subscribed — unlock the Studio and the full store"}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-accent">Manage →</span>
      </Link>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4 text-center shadow-book-sm">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="mt-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Order history */}
      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <Package className="h-4.5 w-4.5 text-accent" /> Order history
          </h2>
          <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
            View all orders →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
            No print orders yet — open any store book and choose “Order print copy”.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {recentOrders.map((o) => (
              <div
                key={o._id.toString()}
                className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {o.bookTitle} <span className="text-sm text-muted">× {o.quantity}</span>
                  </p>
                  <p className="text-xs text-faint">
                    {o.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · #{o._id.toString().slice(-6)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-muted">{STATUS_LABEL[o.status]}</span>
                  <span className="font-semibold">{formatCents(o.amounts.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery address */}
      <div className="mt-8">
        <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-semibold">
          <MapPin className="h-4.5 w-4.5 text-accent" /> Delivery address
        </h2>
        <p className="mb-4 text-sm text-muted">
          Prefilled at checkout when you order printed books.
        </p>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
          <AddressEditor
            initial={
              userDoc?.savedAddress
                ? {
                    name: userDoc.savedAddress.name,
                    phone: userDoc.savedAddress.phone,
                    line1: userDoc.savedAddress.line1,
                    line2: userDoc.savedAddress.line2,
                    city: userDoc.savedAddress.city,
                    state: userDoc.savedAddress.state,
                    postalCode: userDoc.savedAddress.postalCode,
                    country: userDoc.savedAddress.country,
                  }
                : null
            }
          />
        </div>
      </div>

      {/* Shortcuts */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/connections"
          className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
        >
          <Plug className="h-4 w-4 text-accent" /> Connections
        </Link>
        <Link
          href="/library?shelf=mine"
          className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
        >
          My books
        </Link>
        <Link
          href="/contact"
          className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
