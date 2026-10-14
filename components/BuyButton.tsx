"use client";

import { useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";

/** Buy one book. The price is fixed server-side; this only starts checkout. */
export function BuyButton({
  bookId,
  priceCents,
}: {
  bookId: string;
  priceCents: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function buy() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/buy`, { method: "POST" });
      // Read as text first: a route that throws returns an empty body, and
      // parsing that would swallow whatever the server actually said.
      const raw = await res.text();
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (data.owned === true) {
        window.location.href = `/read/${bookId}`;
        return;
      }
      if (!res.ok || typeof data.url !== "string") {
        setError((data.error as string) ?? "Couldn't start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        onClick={buy}
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingBag className="h-4 w-4" />
        )}
        Buy · ${(priceCents / 100).toFixed(2)}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
