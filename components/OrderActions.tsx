"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Trash2 } from "lucide-react";

/** Actions on an unpaid order: resume checkout, or remove it. */
export function OrderActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "remove" | null>(null);
  const [error, setError] = useState("");

  async function pay() {
    if (busy) return;
    setBusy("pay");
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Could not resume checkout.");
        router.refresh();
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    if (!window.confirm("Remove this unpaid order?")) return;
    setBusy("remove");
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      <button
        onClick={pay}
        disabled={busy !== null}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {busy === "pay" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        Complete payment
      </button>
      <button
        onClick={remove}
        disabled={busy !== null}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-red-600 disabled:opacity-50"
      >
        {busy === "remove" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Remove
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
