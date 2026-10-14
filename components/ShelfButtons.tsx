"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, CheckCircle2, Library, Loader2 } from "lucide-react";

interface ShelfState {
  inLibrary: boolean;
  wantToRead: boolean;
  finished: boolean;
}

/** Toggle buttons for library shelves on a book detail page. */
export function ShelfButtons({
  bookId,
  initial,
}: {
  bookId: string;
  initial: ShelfState;
}) {
  const router = useRouter();
  const [state, setState] = useState<ShelfState>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(field: keyof ShelfState) {
    if (busy) return;
    setBusy(field);
    const value = !state[field];
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, field, value }),
      });
      if (res.ok) {
        setState((s) => ({ ...s, [field]: value }));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const buttons: {
    field: keyof ShelfState;
    label: string;
    activeLabel: string;
    icon: typeof Library;
  }[] = [
    { field: "inLibrary", label: "Add to Library", activeLabel: "In Library", icon: Library },
    { field: "wantToRead", label: "Want to Read", activeLabel: "Want to Read ✓", icon: ArrowRightCircle },
    { field: "finished", label: "Mark Finished", activeLabel: "Finished ✓", icon: CheckCircle2 },
  ];

  return (
    <div className="flex flex-wrap gap-2.5">
      {buttons.map((b) => (
        <button
          key={b.field}
          onClick={() => toggle(b.field)}
          disabled={busy !== null}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
            state[b.field]
              ? "bg-accent-soft text-accent-deep"
              : "border border-line bg-surface text-ink hover:bg-raised"
          }`}
        >
          {busy === b.field ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <b.icon className="h-4 w-4" />
          )}
          {state[b.field] ? b.activeLabel : b.label}
        </button>
      ))}
    </div>
  );
}
