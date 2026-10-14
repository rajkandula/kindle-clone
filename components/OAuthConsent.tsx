"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";

interface ConsentRequest {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  scope: string;
}

/** Approve / cancel buttons on the OAuth consent screen. */
export function OAuthConsent({ request }: { request: ConsentRequest }) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "deny") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const res = await fetch("/api/oauth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.redirect) {
        setError(data.error_description ?? data.error ?? "Something went wrong — try again.");
        setBusy(null);
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Network error — try again.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => decide("approve")}
          disabled={busy !== null}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {busy === "approve" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Allow access
        </button>
        <button
          onClick={() => decide("deny")}
          disabled={busy !== null}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy === "deny" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          Cancel
        </button>
      </div>
      {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
