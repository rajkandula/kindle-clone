"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Tag } from "lucide-react";

const MIN_CENTS = 299;
const AUTHOR_SHARE = 0.7;

/** Mirrors lib/models splitSale so the author sees the real figure as they type. */
function youEarn(cents: number): number {
  const fee = Math.round(cents * 0.029) + 30;
  return Math.round(Math.max(0, cents - fee) * AUTHOR_SHARE);
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Set a book's price.
 *
 * Shows what the author actually receives, not just the list price — the
 * difference is card fees plus our share, and hiding it would make the first
 * payout a nasty surprise.
 */
export function PriceControl({
  bookId,
  initialEnabled,
  initialPriceCents,
  initialPrintPriceCents,
  printCostCents,
  minPrintPriceCents,
  isFree,
}: {
  bookId: string;
  initialEnabled: boolean;
  initialPriceCents: number;
  initialPrintPriceCents: number;
  /** What one copy costs to produce — the floor the list price must clear. */
  printCostCents: number;
  minPrintPriceCents: number;
  isFree: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [dollars, setDollars] = useState(
    initialPriceCents ? (initialPriceCents / 100).toFixed(2) : "4.99"
  );
  const [printDollars, setPrintDollars] = useState(
    initialPrintPriceCents ? (initialPrintPriceCents / 100).toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const cents = Math.round(parseFloat(dollars || "0") * 100);
  const valid = !enabled || (Number.isFinite(cents) && cents >= MIN_CENTS);
  const printCents = Math.round(parseFloat(printDollars || "0") * 100);
  const printSet = printCents > 0;
  const printValid = !printSet || printCents >= minPrintPriceCents;
  // Margin above production, less the card percentage, split 70/30.
  const printEarn = printSet
    ? Math.round(Math.max(0, printCents - printCostCents - Math.round(printCents * 0.029)) * 0.7)
    : 0;

  async function save(nextEnabled: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          priceCents: cents,
          printPriceCents: printSet ? printCents : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that price.");
        return;
      }
      setEnabled(data.enabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  if (isFree) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
        <p className="text-sm font-semibold">Selling this book</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          This book is marked free, so it can&apos;t be sold. Turn off the free flag
          first if you&apos;d like to charge for it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft">
          <Tag className="h-4 w-4 text-accent-deep" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sell this book</p>
          <p className="text-xs text-muted">
            {enabled ? "Readers buy it individually" : "Included with Lectoire Plus"}
          </p>
        </div>
        <button
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            void save(next);
          }}
          disabled={saving}
          role="switch"
          aria-checked={enabled}
          aria-label="Sell this book"
          className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-book-sm transition-transform ${
              enabled ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div className="mt-4 flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-faint uppercase">
                Price
              </span>
              <span className="flex items-center rounded-xl border border-line bg-paper px-3 focus-within:border-accent">
                <span className="text-sm text-muted">$</span>
                <input
                  type="number"
                  min="2.99"
                  step="0.01"
                  value={dollars}
                  onChange={(e) => setDollars(e.target.value)}
                  className="w-full bg-transparent px-1.5 py-2.5 text-[15px] font-semibold outline-none"
                />
              </span>
            </label>
            <button
              onClick={() => void save(true)}
              disabled={saving || !valid || !printValid}
              className="mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          {valid ? (
            <p className="mt-3 rounded-xl bg-raised px-3.5 py-2.5 text-sm">
              You earn{" "}
              <strong className="font-semibold text-accent-deep">{money(youEarn(cents))}</strong>{" "}
              per sale
              <span className="block text-xs text-muted">
                {money(cents)} less card fees, then your 70% share
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-red-600">
              The lowest price is {money(MIN_CENTS)} — below that, card fees eat the sale.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-5 border-t border-line pt-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-faint uppercase">
                Paperback price (optional)
              </span>
              <span className="flex items-center rounded-xl border border-line bg-paper px-3 focus-within:border-accent">
                <span className="text-sm text-muted">$</span>
                <input
                  type="number"
                  min={(minPrintPriceCents / 100).toFixed(2)}
                  step="0.01"
                  value={printDollars}
                  onChange={(e) => setPrintDollars(e.target.value)}
                  placeholder={(minPrintPriceCents / 100).toFixed(2)}
                  className="w-full bg-transparent px-1.5 py-2.5 text-[15px] font-semibold outline-none"
                />
              </span>
            </label>
            {printSet && printValid ? (
              <p className="mt-2.5 rounded-xl bg-raised px-3.5 py-2.5 text-sm">
                You earn{" "}
                <strong className="font-semibold text-accent-deep">{money(printEarn)}</strong>{" "}
                per copy
                <span className="block text-xs text-muted">
                  {money(printCostCents)} printing, then your 70% of what&apos;s left
                </span>
              </p>
            ) : printSet ? (
              <p className="mt-2 text-xs text-red-600">
                This book costs {money(printCostCents)} to print, so the lowest price is{" "}
                {money(minPrintPriceCents)}.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Leave blank and paperbacks sell at cost — readers can still order one,
                but you earn nothing from it.
              </p>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            A priced book leaves Lectoire Plus and is bought on its own.{" "}
            <Link href="/earnings" className="cursor-pointer underline underline-offset-2">
              Set up payouts
            </Link>{" "}
            so we can send you the money.
          </p>
        </>
      )}
    </div>
  );
}
