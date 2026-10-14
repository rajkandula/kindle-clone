import Link from "next/link";
import { connectDB } from "@/lib/db";
import { bookSales } from "@/lib/analytics";
import { formatCents } from "@/lib/pricing";
import { StatCard, Panel, Empty } from "@/components/AdminUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books · Admin" };

export default async function AdminBooksPage() {
  await connectDB();
  const rows = await bookSales();

  const sold = rows.filter((b) => b.salesCount > 0);
  const gross = rows.reduce((s, b) => s + b.grossCents, 0);
  const listedNotSelling = rows.filter((b) => b.salesCount === 0 && b.priceCents > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Books sold" value={String(sold.length)} sub="titles with a sale" />
        <StatCard label="Copies sold" value={String(rows.reduce((s, b) => s + b.salesCount, 0))} />
        <StatCard label="Gross from books" value={formatCents(gross)} tone="accent" />
        <StatCard
          label="Priced, no sales"
          value={String(listedNotSelling)}
          sub={listedNotSelling > 0 ? "listed but not selling" : undefined}
        />
      </div>

      <Panel title="Sales by book">
        {rows.length === 0 ? (
          <Empty>No book has been priced or sold yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Book</th>
                  <th className="px-5 py-2.5 font-medium">Digital</th>
                  <th className="px-5 py-2.5 font-medium">Paperback</th>
                  <th className="px-5 py-2.5 font-medium">Copies</th>
                  <th className="px-5 py-2.5 font-medium">Gross</th>
                  <th className="px-5 py-2.5 font-medium">To author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/store/${b.id}`}
                        className="block cursor-pointer font-medium hover:text-accent-deep"
                      >
                        {b.title}
                      </Link>
                      <span className="text-xs text-muted">{b.authorName}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {b.priceCents > 0 ? formatCents(b.priceCents) : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {b.printPriceCents > 0 ? formatCents(b.printPriceCents) : "at cost"}
                    </td>
                    <td className="px-5 py-3">{b.salesCount}</td>
                    <td className="px-5 py-3 font-medium">{formatCents(b.grossCents)}</td>
                    <td className="px-5 py-3 text-muted">{formatCents(b.authorCents)}</td>
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
