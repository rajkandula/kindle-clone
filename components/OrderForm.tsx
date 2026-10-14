"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Package, ShieldCheck } from "lucide-react";
import { Cover } from "./Cover";
import type { BookLite } from "@/lib/models";

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

const EMPTY_ADDRESS: AddressInput = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function OrderForm({
  book,
  pages,
  pricing,
  savedAddress,
  wasCancelled,
}: {
  book: BookLite;
  pages: number;
  pricing: { basePrint: number; perPage: number; delivery: number; taxRate: number };
  savedAddress: AddressInput | null;
  wasCancelled: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState<AddressInput>(savedAddress ?? EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(wasCancelled ? "Checkout was cancelled — no charge was made." : "");

  const totals = useMemo(() => {
    const printingPerCopy = pricing.basePrint + pages * pricing.perPage;
    const printing = printingPerCopy * quantity;
    const tax = Math.round((printing + pricing.delivery) * pricing.taxRate);
    return { printingPerCopy, printing, delivery: pricing.delivery, tax, total: printing + pricing.delivery + tax };
  }, [quantity, pages, pricing]);

  function setField(field: keyof AddressInput, value: string) {
    setAddress((a) => ({ ...a, [field]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, quantity, address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl; // Stripe hosted checkout
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";
  const label = "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
      <Link
        href={`/store/${book.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Back to book
      </Link>
      <h1 className="font-display mb-8 text-4xl font-semibold tracking-tight">
        Order a printed copy
      </h1>

      <div className="flex flex-col gap-10 md:flex-row">
        {/* Summary column */}
        <div className="w-full shrink-0 md:w-72">
          <div className="flex gap-4">
            <Cover book={book} className="w-24 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display leading-snug font-semibold">{book.title}</h2>
              <p className="mt-0.5 text-sm text-muted">{book.authorName}</p>
              <p className="mt-1 text-xs text-faint">
                Paperback · {pages} pages
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">
                Printing ({quantity} × {fmt(totals.printingPerCopy)})
              </span>
              <span>{fmt(totals.printing)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Delivery</span>
              <span>{fmt(totals.delivery)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tax ({Math.round(pricing.taxRate * 100)}%)</span>
              <span>{fmt(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>Total</span>
              <span>{fmt(totals.total)}</span>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Payment is handled securely by Stripe. We print your copy and ship it to
            the address you provide.
          </p>
        </div>

        {/* Form column */}
        <form onSubmit={submit} className="min-w-0 flex-1 space-y-4">
          <div>
            <span className={label}>Quantity</span>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`h-10 w-12 rounded-xl border text-sm font-semibold transition-colors ${
                    quantity === q
                      ? "border-accent bg-accent-soft text-accent-deep"
                      : "border-line bg-surface hover:bg-raised"
                  }`}
                >
                  {q}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.min(Math.max(Number(e.target.value) || 1, 1), 10))
                }
                aria-label="Custom quantity"
                className="h-10 w-20 rounded-xl border border-line bg-paper px-3 text-center text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <h2 className="font-display pt-2 text-lg font-semibold">Delivery address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Full name *</span>
              <input required value={address.name} onChange={(e) => setField("name", e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className={label}>Phone</span>
              <input value={address.phone} onChange={(e) => setField("phone", e.target.value)} className={input} />
            </label>
          </div>
          <label className="block">
            <span className={label}>Street address *</span>
            <input required value={address.line1} onChange={(e) => setField("line1", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Apartment, suite, etc.</span>
            <input value={address.line2} onChange={(e) => setField("line2", e.target.value)} className={input} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>City *</span>
              <input required value={address.city} onChange={(e) => setField("city", e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className={label}>State / region</span>
              <input value={address.state} onChange={(e) => setField("state", e.target.value)} className={input} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Postal code *</span>
              <input required value={address.postalCode} onChange={(e) => setField("postalCode", e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className={label}>Country *</span>
              <input required value={address.country} onChange={(e) => setField("country", e.target.value)} className={input} />
            </label>
          </div>

          {error && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Package className="h-5 w-5" />
            )}
            Continue to payment · {fmt(totals.total)}
          </button>
        </form>
      </div>
    </div>
  );
}
