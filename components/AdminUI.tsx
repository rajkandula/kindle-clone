import { formatCents } from "@/lib/pricing";

export function StatCard({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "accent" | "warn";
}) {
  const valueTone =
    tone === "accent" ? "text-accent-deep" : tone === "warn" ? "text-red-700" : "";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
      <p className="text-[11px] font-medium tracking-wide text-faint uppercase">{label}</p>
      <p className={`font-display mt-1.5 text-2xl font-semibold ${valueTone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-book-sm">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Money({ cents, dim }: { cents: number; dim?: boolean }) {
  return (
    <span className={dim && cents === 0 ? "text-faint" : "font-medium"}>
      {formatCents(cents)}
    </span>
  );
}
