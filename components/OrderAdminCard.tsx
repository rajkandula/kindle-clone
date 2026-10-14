"use client";

import { useState } from "react";
import { Check, Download, Loader2, MapPin } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/order-statuses";

interface AdminOrder {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  quantity: number;
  pages: number;
  amounts: { printing: number; delivery: number; tax: number; total: number };
  status: string;
  note: string;
  createdAt: string;
  customer: string;
  address: {
    name: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function OrderAdminCard({ order }: { order: AdminOrder }) {
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.note);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(nextStatus?: string) {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus ?? status, note }),
      });
      if (res.ok) {
        if (nextStatus) setStatus(nextStatus);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setBusy(false);
    }
  }

  const a = order.address;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-faint">
            #{order.id.slice(-6)} ·{" "}
            {new Date(order.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <h2 className="mt-0.5 font-semibold">
            {order.bookTitle}
            <span className="ml-2 text-sm font-normal text-muted">
              × {order.quantity} · {order.pages}p
            </span>
          </h2>
          <p className="text-sm text-muted">
            by {order.bookAuthor} · ordered by {order.customer}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{fmt(order.amounts.total)}</p>
          <p className="text-[11px] text-faint">
            print {fmt(order.amounts.printing)} + ship {fmt(order.amounts.delivery)} + tax{" "}
            {fmt(order.amounts.tax)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="min-w-56 flex-1 rounded-xl bg-paper p-3.5 text-sm leading-relaxed">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
            <MapPin className="h-3 w-3" /> Deliver to
          </p>
          {a.name}
          {a.phone && ` · ${a.phone}`}
          <br />
          {a.line1}
          {a.line2 && <>, {a.line2}</>}
          <br />
          {a.city}
          {a.state && `, ${a.state}`} {a.postalCode}, {a.country}
        </div>

        <div className="flex min-w-64 flex-1 flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => void save(e.target.value)}
              disabled={busy}
              aria-label="Order status"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <a
              href={`/api/books/${order.bookId}/download`}
              download
              title="Download files for printing"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-raised"
            >
              <Download className="h-4 w-4" /> Print files
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tracking note shown to the customer (carrier, tracking #)"
              className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => void save()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
