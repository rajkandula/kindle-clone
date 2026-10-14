import { connectDB } from "@/lib/db";
import { creators } from "@/lib/analytics";
import { formatCents } from "@/lib/pricing";
import { StatCard, Panel, Empty } from "@/components/AdminUI";
import { CreatorActions } from "@/components/CreatorActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creators · Admin" };

export default async function CreatorsPage() {
  await connectDB();
  const rows = await creators();

  const owed = rows.reduce((s, c) => s + c.balanceCents, 0);
  const earned = rows.reduce((s, c) => s + c.earnedCents, 0);
  const frozen = rows.filter((c) => c.frozen).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Creators earning" value={String(rows.length)} />
        <StatCard label="Earned all time" value={formatCents(earned)} tone="accent" />
        <StatCard label="Owed right now" value={formatCents(owed)} />
        <StatCard
          label="Frozen"
          value={String(frozen)}
          sub={frozen > 0 ? "Needs a decision" : undefined}
          tone={frozen > 0 ? "warn" : "plain"}
        />
      </div>

      <Panel title="Creators">
        {rows.length === 0 ? (
          <Empty>
            No one has earned anything yet. Creators appear here once they price a book
            and make their first sale.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Creator</th>
                  <th className="px-5 py-2.5 font-medium">Books</th>
                  <th className="px-5 py-2.5 font-medium">Sales</th>
                  <th className="px-5 py-2.5 font-medium">Earned</th>
                  <th className="px-5 py-2.5 font-medium">Owed</th>
                  <th className="px-5 py-2.5 font-medium">Paid out</th>
                  <th className="px-5 py-2.5 font-medium">Payouts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.userId} className={c.frozen ? "bg-red-50/60" : ""}>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{c.name}</span>
                      <span className="text-xs text-muted">@{c.username}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">{c.booksPublished}</td>
                    <td className="px-5 py-3 text-muted">{c.salesCount}</td>
                    <td className="px-5 py-3 font-medium">{formatCents(c.earnedCents)}</td>
                    <td className="px-5 py-3">{formatCents(c.balanceCents)}</td>
                    <td className="px-5 py-3 text-muted">{formatCents(c.paidOutCents)}</td>
                    <td className="px-5 py-3">
                      <CreatorActions
                        userId={c.userId}
                        frozen={c.frozen}
                        frozenReason={c.frozenReason}
                        onboarded={c.onboarded}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
