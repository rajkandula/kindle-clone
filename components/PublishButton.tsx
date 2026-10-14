"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";

/** Publish/unpublish a book you own to the community store. */
export function PublishButton({
  bookId,
  published,
}: {
  bookId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: !published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
          published
            ? "border border-line bg-surface text-muted hover:bg-raised"
            : "bg-ink text-white hover:opacity-85"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        {published ? "Unpublish" : "Publish to Store"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
