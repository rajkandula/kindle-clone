"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Freeze or release one creator's payouts.
 *
 * The abuse screen freezes on suspicion, and a genuine launch day looks a lot
 * like wash trading — so this is the release valve that stops a false positive
 * locking an honest author out of their money for good.
 */
export function CreatorActions({
  userId,
  frozen,
  frozenReason,
  onboarded,
}: {
  userId: string;
  frozen: boolean;
  frozenReason: string;
  onboarded: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setFrozen(next: boolean) {
    setBusy(true);
    try {
      await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          frozen: next,
          reason: next ? "Paused by an administrator while we review this account." : "",
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!onboarded && !frozen) {
    return <span className="text-xs text-faint">Setup not finished</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        onClick={() => setFrozen(!frozen)}
        disabled={busy}
        className={`flex w-fit cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
          frozen
            ? "bg-accent text-white hover:bg-accent-deep"
            : "border border-line text-muted hover:text-ink"
        }`}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {frozen ? "Release payouts" : "Freeze payouts"}
      </button>
      {frozen && frozenReason && (
        <span className="max-w-56 text-[11px] leading-snug text-red-700">{frozenReason}</span>
      )}
    </span>
  );
}
