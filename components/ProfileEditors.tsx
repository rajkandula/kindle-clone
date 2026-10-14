"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";

const input =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const label = "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase";

/** Inline display-name editor. */
export function NameEditor({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Edit name"
        aria-label="Edit name"
        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }
  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoFocus
        aria-label="Display name"
        className="rounded-xl border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        aria-label="Save name"
        className="rounded-lg bg-ink p-2 text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
    </form>
  );
}

interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const EMPTY: AddressInput = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

/** Saved delivery address editor — what checkout prefills. */
export function AddressEditor({ initial }: { initial: AddressInput | null }) {
  const [address, setAddress] = useState<AddressInput>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof AddressInput, value: string) =>
    setAddress((a) => ({ ...a, [field]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Full name</span>
          <input value={address.name} onChange={(e) => set("name", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input value={address.phone} onChange={(e) => set("phone", e.target.value)} className={input} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Street address</span>
        <input value={address.line1} onChange={(e) => set("line1", e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={label}>Apartment, suite, etc.</span>
        <input value={address.line2} onChange={(e) => set("line2", e.target.value)} className={input} />
      </label>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>City</span>
          <input value={address.city} onChange={(e) => set("city", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>State / region</span>
          <input value={address.state} onChange={(e) => set("state", e.target.value)} className={input} />
        </label>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Postal code</span>
          <input value={address.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Country</span>
          <input value={address.country} onChange={(e) => set("country", e.target.value)} className={input} />
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saved ? "Saved" : "Save address"}
      </button>
    </form>
  );
}
