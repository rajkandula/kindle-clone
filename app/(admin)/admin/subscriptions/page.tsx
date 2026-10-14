import { connectDB } from "@/lib/db";
import { revenueSummary, subscribers } from "@/lib/analytics";
import { formatCents } from "@/lib/pricing";
import { StatCard, Panel, Empty } from "@/components/AdminUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions · Admin" };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function SubscriptionsPage() {
  await connectDB();
  const [r, rows] = await Promise.all([revenueSummary(), subscribers()]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Monthly recurring" value={formatCents(r.mrrCents)} tone="accent" />
        <StatCard label="Active" value={String(r.activeSubs)} />
        <StatCard
          label="Payment failing"
          value={String(r.pastDueSubs)}
          tone={r.pastDueSubs > 0 ? "warn" : "plain"}
        />
        <StatCard label="Cancelled" value={String(r.canceledSubs)} />
      </div>

      <Panel title={`Subscribers (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty>No one has subscribed to Lectoire Plus yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Member</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Renews</th>
                  <th className="px-5 py-2.5 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{s.name}</span>
                      <span className="text-xs text-muted">@{s.username}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={s.status} cancelling={s.cancelling} />
                    </td>
                    <td className="px-5 py-3 text-muted">{when(s.renewsAt)}</td>
                    <td className="px-5 py-3 text-muted">{when(s.joinedAt)}</td>
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

function StatusPill({ status, cancelling }: { status: string; cancelling: boolean }) {
  const tone =
    status === "active"
      ? cancelling
        ? "bg-amber-100 text-amber-800"
        : "bg-green-100 text-green-800"
      : status === "past_due"
        ? "bg-red-100 text-red-800"
        : "bg-raised text-muted";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {status === "active" && cancelling ? "cancelling" : status.replace("_", " ")}
    </span>
  );
}
