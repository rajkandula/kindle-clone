"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function UserRoleButton({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = isAdmin ? "user" : "admin";
    if (!window.confirm(`Change this user's role to ${next}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isAdmin ? (
        "Remove admin"
      ) : (
        "Make admin"
      )}
    </button>
  );
}
