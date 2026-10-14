"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

/** Subscribe / cancel / resume controls on the /plus page. */
export function PlusActions({
  state,
}: {
  state: "none" | "active" | "cancelling" | "past_due";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(method: "POST" | "DELETE" | "PATCH") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/plus", { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const spinner = busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null;

  return (
    <div className="flex flex-col items-stretch gap-2.5">
      {(state === "none" || state === "past_due") && (
        <button
          onClick={() => call("POST")}
          disabled={busy}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {spinner ?? <Sparkles className="h-4 w-4" />}
          {state === "past_due" ? "Fix payment & continue" : "Get Lectoire Plus"}
        </button>
      )}
      {state === "active" && (
        <button
          onClick={() => {
            if (window.confirm("Cancel Lectoire Plus? You keep access until the end of the billing period.")) {
              call("DELETE");
            }
          }}
          disabled={busy}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-red-600 disabled:opacity-50"
        >
          {spinner}
          Cancel subscription
        </button>
      )}
      {state === "cancelling" && (
        <button
          onClick={() => call("PATCH")}
          disabled={busy}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {spinner}
          Resume subscription
        </button>
      )}
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
