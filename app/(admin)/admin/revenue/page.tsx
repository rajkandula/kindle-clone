import { connectDB } from "@/lib/db";
import { revenueSummary } from "@/lib/analytics";
import { formatCents } from "@/lib/pricing";
import { StatCard, Panel } from "@/components/AdminUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue · Admin" };

export default async function RevenuePage() {
  await connectDB();
  const r = await revenueSummary();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly recurring"
          value={formatCents(r.mrrCents)}
          sub={`${r.activeSubs} active Plus`}
          tone="accent"
        />
        <StatCard
          label="Book sales (gross)"
          value={formatCents(r.bookGrossCents)}
          sub="Digital + paperback margin"
        />
        <StatCard
          label="Print orders"
          value={formatCents(r.printGrossCents)}
          sub={`${r.printOrders} orders`}
        />
        <StatCard
          label="Owed to creators"
          value={formatCents(r.authorOwedCents)}
          sub={`${formatCents(r.paidOutCents)} paid out so far`}
          tone={r.authorOwedCents > 0 ? "warn" : "plain"}
        />
      </div>

      <Panel title="Where the money goes">
        <dl className="divide-y divide-line text-sm">
          <Row label="Charged to cards (books + print)" value={r.totalCollectedCents} strong />
          <Row label="Creators' share of book sales" value={-r.authorEarnedCents} />
          <Row label="Lectoire's share of book sales" value={r.bookPlatformCents} />
          <Row label="Print orders (includes production cost)" value={r.printGrossCents} />
          <Row label="Recurring subscription revenue / month" value={r.mrrCents} strong />
        </dl>
        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-faint">
          Figures come from Lectoire&apos;s own ledger. Subscription totals over time,
          refunds and fee detail live in your Stripe dashboard, which is the record of
          truth for accounting.
        </p>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={String(r.activeSubs)} />
        <StatCard
          label="Payment failing"
          value={String(r.pastDueSubs)}
          tone={r.pastDueSubs > 0 ? "warn" : "plain"}
        />
        <StatCard label="Cancelling at period end" value={String(r.cancellingSubs)} />
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className={strong ? "font-medium" : "text-muted"}>{label}</dt>
      <dd className={`font-display ${strong ? "font-semibold" : ""} ${value < 0 ? "text-muted" : ""}`}>
        {value < 0 ? `−${formatCents(-value)}` : formatCents(value)}
      </dd>
    </div>
  );
}
