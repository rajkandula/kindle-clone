import Link from "next/link";
import { Inbox } from "lucide-react";
import { connectDB } from "@/lib/db";
import { ContactMessage, User } from "@/lib/models";
import {
  MessageAdminCard,
  type ContactMessageLite,
} from "@/components/MessageAdminCard";

export const metadata = { title: "Messages · Admin" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "read", label: "Read" },
  { key: "replied", label: "Replied" },
] as const;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (status && ["new", "read", "replied"].includes(status)) filter.status = status;

  const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).limit(100);

  // Resolve sender accounts in one query
  const userIds = [...new Set(messages.filter((m) => m.userId).map((m) => m.userId!.toString()))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("username")
    : [];
  const usernameById = new Map(users.map((u) => [u._id.toString(), u.username]));

  const lite: ContactMessageLite[] = messages.map((m) => ({
    id: m._id.toString(),
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: m.status,
    username: m.userId ? (usernameById.get(m.userId.toString()) ?? null) : null,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Contact messages
        </h1>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/admin/messages?status=${f.key}` : "/admin/messages"}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                (status ?? "") === f.key
                  ? "bg-ink text-white"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {lite.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-faint" />
          <p className="text-sm text-muted">
            {status ? "No messages with this status." : "No one has contacted you yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lite.map((m) => (
            <MessageAdminCard key={m.id} msg={m} />
          ))}
        </div>
      )}
    </div>
  );
}
