"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Banknote, ExternalLink, Loader2, TrendingUp } from "lucide-react";

interface Sale {
  id: string;
  title: string;
  grossCents: number;
  authorCents: number;
  status: string;
  createdAt: string;
}

interface Earnings {
  availableCents: number;
  pendingCents: number;
  frozen: boolean;
  frozenReason: string;
  holdDays: number;
  lifetimeCents: number;
  paidOutCents: number;
  onboarded: boolean;
  hasAccount: boolean;
  salesCount: number;
  sales: Sale[];
  authorSharePercent: number;
  minPayoutCents: number;
  payoutsAvailable: boolean;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function EarningsView() {
  const [data, setData] = useState<Earnings | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [notice, setNotice] = useState("");
  /** Somewhere the author can go to fix what just failed. */
  const [action, setAction] = useState<{ url: string; label: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/earnings");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setConnecting(true);
    setNotice("");
    setAction(null);
    try {
      const res = await fetch("/api/earnings", { method: "POST" });
      const body = await readJson(res);
      if (typeof body.url === "string") {
        window.location.href = body.url;
        return;
      }

      // Setup can't proceed, but there's a page that fixes it — open it now
      // rather than describing it. This click is a user gesture, so the tab
      // isn't blocked, and the explanation stays on screen behind it.
      if (typeof body.actionUrl === "string") {
        setAction({
          url: body.actionUrl,
          label: (body.actionLabel as string) ?? "Open Stripe",
        });
        window.open(body.actionUrl, "_blank", "noreferrer");
      }
      setNotice(
        (body.error as string) ??
          "Couldn't start payout setup. Try again in a moment, or get in touch if it keeps happening."
      );
    } catch {
      setNotice("Couldn't reach Lectoire. Check your connection and try again.");
    } finally {
      setConnecting(false);
    }
  }

  /**
   * Read a JSON response without trusting it to be JSON.
   *
   * A route that throws returns an empty body, and calling .json() on that
   * crashes the page with a parse error — hiding whatever actually went wrong.
   */
  async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** Stripe's own dashboard: bank details, payout history, tax documents. */
  async function openStripeDashboard() {
    const res = await fetch("/api/earnings/dashboard", { method: "POST" });
    const body = await readJson(res);
    if (typeof body.url === "string") window.open(body.url, "_blank", "noreferrer");
    else setNotice((body.error as string) ?? "Couldn't open your Stripe dashboard.");
  }

  async function withdraw() {
    setWithdrawing(true);
    setNotice("");
    try {
      const res = await fetch("/api/earnings/withdraw", { method: "POST" });
      const body = await res.json();
      setNotice(
        res.ok
          ? `Sent ${money(body.amountCents)} to your bank — it usually lands in a couple of days.`
          : body.error
      );
      await load();
    } finally {
      setWithdrawing(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const nothingYet = data.salesCount === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ready to pay out" value={money(data.availableCents)} accent />
        <Stat label={`Clearing · ${data.holdDays} days`} value={money(data.pendingCents)} />
        <Stat label="Books sold" value={String(data.salesCount)} />
      </div>

      {data.frozen && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Payouts paused</p>
          <p className="mt-1.5 text-sm leading-relaxed text-red-700">
            {data.frozenReason || "This account is under review."} Get in touch and
            we'll sort it out.
          </p>
        </div>
      )}

      {/* Payout setup */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft">
            {data.onboarded ? (
              <BadgeCheck className="h-5 w-5 text-accent-deep" />
            ) : (
              <Banknote className="h-5 w-5 text-accent-deep" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">
              {data.onboarded ? "Payouts are set up" : "Set up payouts"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {data.onboarded
                ? `Withdraw whatever has cleared and Stripe deposits it in your bank, usually within a couple of business days. Your bank details and tax forms live with Stripe — Lectoire never sees them.`
                : `Payouts run through Stripe, so your bank details, ID and tax forms go to them directly and never touch Lectoire. You keep ${data.authorSharePercent}% of every sale after card fees.`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              {`Earnings clear ${data.holdDays} days after a sale`}, which is how long a card
              payment can be disputed. It protects you as much as us — a chargeback
              against a book you didn&apos;t sell is caught before the money moves.
            </p>
            {data.onboarded && data.availableCents >= data.minPayoutCents && !data.frozen && (
              <button
                onClick={withdraw}
                disabled={withdrawing}
                className="mt-4 flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                {withdrawing && <Loader2 className="h-4 w-4 animate-spin" />}
                Withdraw {money(data.availableCents)}
              </button>
            )}
            {data.onboarded &&
              data.availableCents < data.minPayoutCents &&
              !data.frozen && (
                <p className="mt-3 text-xs text-faint">
                  You can withdraw once {money(data.minPayoutCents)} has cleared. There&apos;s
                  no upper limit.
                </p>
              )}
            {data.onboarded && (
              <button
                onClick={openStripeDashboard}
                className="mt-3 block cursor-pointer text-xs font-medium text-accent-deep underline underline-offset-2 hover:text-accent"
              >
                Bank details & payout history on Stripe
              </button>
            )}
            {notice && (
              <p
                className={`mt-3 text-xs leading-relaxed font-medium ${
                  /couldn't|can't|need|aren't|error/i.test(notice)
                    ? "text-red-700"
                    : "text-accent-deep"
                }`}
              >
                {notice}
              </p>
            )}
            {action && (
              <a
                href={action.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-4 py-2 text-xs font-semibold text-accent-deep transition-colors hover:bg-accent hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {action.label}
              </a>
            )}
            {!data.onboarded && (
              <button
                onClick={connect}
                disabled={connecting || !data.payoutsAvailable}
                className="mt-4 flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {data.hasAccount ? "Finish setup with Stripe" : "Connect with Stripe"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales */}
      <div className="rounded-2xl border border-line bg-surface shadow-book-sm">
        <h2 className="font-display border-b border-line px-6 py-4 text-lg font-semibold">
          Sales
        </h2>
        {nothingYet ? (
          <div className="px-6 py-12 text-center">
            <TrendingUp className="mx-auto mb-3 h-6 w-6 text-faint" />
            <p className="text-sm font-medium">No sales yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              Set a price on a published book and it appears in the store for readers to
              buy. Every sale shows up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.sales.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-6 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="text-xs text-muted">
                    {new Date(s.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {s.status === "refunded" && " · refunded"}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    s.status === "refunded" ? "text-faint line-through" : "text-accent-deep"
                  }`}
                >
                  {money(s.authorCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <p className="text-[11px] font-medium tracking-wide text-faint uppercase">{label}</p>
      <p
        className={`font-display mt-1.5 text-2xl font-semibold ${
          accent ? "text-accent-deep" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
