import { connectDB } from "@/lib/db";
import { getAdminUser } from "@/lib/auth";
import { Book, Order, User } from "@/lib/models";
import { UserRoleButton } from "@/components/UserRoleButton";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = (await getAdminUser())!;
  await connectDB();

  const users = await User.find({}).sort({ createdAt: -1 }).limit(200);
  const [bookCounts, orderCounts] = await Promise.all([
    Book.aggregate<{ _id: unknown; n: number }>([
      { $match: { ownerId: { $ne: null } } },
      { $group: { _id: "$ownerId", n: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: unknown; n: number }>([
      { $group: { _id: "$userId", n: { $sum: 1 } } },
    ]),
  ]);
  const books = new Map(bookCounts.map((b) => [String(b._id), b.n]));
  const orders = new Map(orderCounts.map((o) => [String(o._id), o.n]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] tracking-wide text-faint uppercase">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Books</th>
            <th className="px-4 py-3">Orders</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const id = u._id.toString();
            return (
              <tr key={id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-muted">@{u.username}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {u.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">{books.get(id) ?? 0}</td>
                <td className="px-4 py-3">{orders.get(id) ?? 0}</td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-deep">
                      admin
                    </span>
                  ) : (
                    <span className="text-muted">user</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {id !== admin.id && (
                    <UserRoleButton userId={id} isAdmin={u.role === "admin"} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
