"use client";

import { useCallback, useEffect, useState } from "react";
import { Headphones, Loader2, RefreshCw } from "lucide-react";

interface Status {
  enabled: boolean;
  published: boolean;
  total: number;
  ready: number;
  preparing: number;
  outdated: number;
}

/**
 * Audiobook status for the author, with an explicit "narrate" action.
 *
 * Editing never triggers narration on its own — only the author knows when a
 * chapter is finished, so re-rendering is their call.
 */
export function NarrationPanel({ bookId }: { bookId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/narrate`);
      if (res.ok) setStatus(await res.json());
    } catch {
      /* transient */
    }
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* While chapters are rendering, keep the count moving. */
  useEffect(() => {
    if (!status?.preparing) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [status?.preparing, load]);

  async function narrate() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/books/${bookId}/narrate`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!status?.enabled || status.total === 0) return null;

  const allDone = status.ready === status.total;
  const label = allDone
    ? "Audiobook is up to date"
    : status.preparing > 0
      ? `Narrating — ${status.ready}/${status.total} chapters ready`
      : status.ready > 0
        ? `${status.outdated} chapter${status.outdated === 1 ? "" : "s"} changed since narration`
        : "No audiobook yet";

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft">
          <Headphones className="h-4.5 w-4.5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Audiobook</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${Math.round((status.ready / status.total) * 100)}%` }}
        />
      </div>

      {!allDone && (
        <button
          onClick={narrate}
          disabled={busy || status.preparing > 0}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {busy || status.preparing > 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {status.ready > 0 ? "Update the audiobook" : "Narrate this book"}
        </button>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        {allDone
          ? "Readers hear it instantly. Edit a chapter and its audio is retired until you narrate again."
          : "Narration runs in the background — you can keep writing. Do it when you're happy with the text."}
      </p>
    </div>
  );
}
