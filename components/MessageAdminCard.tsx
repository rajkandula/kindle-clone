"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Trash2, UserRound } from "lucide-react";

export interface ContactMessageLite {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied";
  username: string | null;
  createdAt: string;
}

const STATUS_META: Record<ContactMessageLite["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-amber-100 text-amber-800" },
  read: { label: "Read", cls: "bg-stone-200 text-stone-700" },
  replied: { label: "Replied", cls: "bg-emerald-100 text-emerald-800" },
};

export function MessageAdminCard({ msg }: { msg: ContactMessageLite }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(msg.status === "new");

  async function setStatus(status: ContactMessageLite["status"]) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!window.confirm("Delete this message permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${msg.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const meta = STATUS_META[msg.status];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 cursor-pointer text-left"
          aria-expanded={open}
        >
          <h2 className="font-semibold">{msg.subject}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {msg.name}
              {msg.username && <span className="text-faint">(@{msg.username})</span>}
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> {msg.email}
            </span>
            <span className="text-faint">
              {new Date(msg.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
          <select
            value={msg.status}
            onChange={(e) => setStatus(e.target.value as ContactMessageLite["status"])}
            disabled={busy}
            aria-label="Set message status"
            className="cursor-pointer rounded-lg border border-line bg-paper px-2 py-1.5 text-xs font-medium outline-none focus:border-accent"
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
          </select>
          <button
            onClick={remove}
            disabled={busy}
            aria-label="Delete message"
            className="cursor-pointer rounded-lg p-2 text-faint transition-colors hover:bg-red-50 hover:text-red-600"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
          {msg.message}
        </p>
      )}
    </div>
  );
}
