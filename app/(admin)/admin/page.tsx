import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models";
import { bookSales, creators, pulse, revenueSummary } from "@/lib/analytics";
import { formatCents } from "@/lib/pricing";
import { StatCard, Panel, Empty } from "@/components/AdminUI";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default async function AdminDashboard() {
  await connectDB();
  const [p, r, topBooks, topCreators, recentOrders] = await Promise.all([
    pulse(),
    revenueSummary(),
    bookSales(5),
    creators(),
    Order.find({}).sort({ createdAt: -1 }).limit(5),
  ]);

  return (
    <div className="space-y-6">
      {/* Things needing attention come first — a dashboard is a to-do list */}
      {(p.ordersToFulfil > 0 || p.newMessages > 0 || p.frozenCreators > 0 || r.pastDueSubs > 0) && (
        <div className="flex flex-wrap gap-2.5">
          {p.ordersToFulfil > 0 && (
            <Alert href="/admin/orders" text={`${p.ordersToFulfil} order${p.ordersToFulfil === 1 ? "" : "s"} to fulfil`} />
          )}
          {p.newMessages > 0 && (
            <Alert href="/admin/messages" text={`${p.newMessages} unread message${p.newMessages === 1 ? "" : "s"}`} />
          )}
          {p.frozenCreators > 0 && (
            <Alert href="/admin/creators" text={`${p.frozenCreators} creator payout${p.frozenCreators === 1 ? "" : "s"} frozen`} />
          )}
          {r.pastDueSubs > 0 && (
            <Alert href="/admin/subscriptions" text={`${r.pastDueSubs} subscription payment${r.pastDueSubs === 1 ? "" : "s"} failing`} />
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly recurring"
          value={formatCents(r.mrrCents)}
          sub={`${r.activeSubs} on Plus`}
          tone="accent"
        />
        <StatCard
          label="Collected from books"
          value={formatCents(r.totalCollectedCents)}
          sub={`${r.printOrders} print orders`}
        />
        <StatCard label="Members" value={p.users.toLocaleString()} sub={`${p.newUsers7d} joined this week`} />
        <StatCard
          label="Owed to creators"
          value={formatCents(r.authorOwedCents)}
          tone={r.authorOwedCents > 0 ? "warn" : "plain"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Published" value={p.publishedBooks.toLocaleString()} />
        <StatCard label="Drafts" value={p.draftBooks.toLocaleString()} />
        <StatCard label="For sale" value={p.booksForSale.toLocaleString()} />
        <StatCard label="Creators earning" value={String(topCreators.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Best selling books" action={<More href="/admin/books" />}>
          {topBooks.length === 0 ? (
            <Empty>Nothing sold yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {topBooks.map((b) => (
                <li key={b.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{b.title}</span>
                    <span className="text-xs text-muted">
                      {b.authorName} · {b.salesCount} sold
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{formatCents(b.grossCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top creators" action={<More href="/admin/creators" />}>
          {topCreators.length === 0 ? (
            <Empty>No one has earned anything yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {topCreators.slice(0, 5).map((c) => (
                <li key={c.userId} className="flex items-center gap-4 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted">
                      @{c.username} · {c.salesCount} sales
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{formatCents(c.earnedCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent orders" action={<More href="/admin/orders" />}>
        {recentOrders.length === 0 ? (
          <Empty>No print orders yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {recentOrders.map((o) => (
              <li key={o._id.toString()} className="flex items-center gap-4 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.bookTitle}</span>
                  <span className="text-xs text-muted">
                    {when(o.createdAt)} · {o.quantity} copy{o.quantity === 1 ? "" : "s"} ·{" "}
                    {o.status.replace("_", " ")}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {formatCents(o.amounts.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Alert({ href, text }: { href: string; text: string }) {
  return (
    <Link
      href={href}
      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-[13px] font-medium text-accent-deep transition-colors hover:bg-accent hover:text-white"
    >
      {text}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function More({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="cursor-pointer text-xs font-medium text-muted transition-colors hover:text-ink"
    >
      See all
    </Link>
  );
}
