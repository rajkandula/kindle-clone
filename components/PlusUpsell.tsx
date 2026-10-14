import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PLAN, formatPlanPrice } from "@/lib/plan";

/** Paywall card shown in place of Plus-only surfaces (e.g. the Studio). */
export function PlusUpsell({ context }: { context: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-book-sm">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white shadow-book-sm">
        <Sparkles className="h-6 w-6" />
      </span>
      <h2 className="font-display text-2xl font-semibold">Part of {PLAN.name}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{context}</p>
      <Link
        href="/plus?locked=studio"
        className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
      >
        Get {PLAN.name} · {formatPlanPrice()}
      </Link>
      <p className="mt-3 text-xs text-faint">One plan, everything included. Cancel anytime.</p>
    </div>
  );
}
