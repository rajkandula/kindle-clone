import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Check,
  MonitorSmartphone,
  Package,
  Plug,
  Sparkles,
  Store,
} from "lucide-react";
import { getVerifiedUser } from "@/lib/auth";
import { PLAN, formatPlanPrice } from "@/lib/plan";
import { RESOURCES } from "@/lib/site";

const PRODUCT_CARDS = [
  {
    icon: Store,
    title: "The Book Store",
    body: "Original books written for Lectoire in every genre — thrillers, romance, poetry, history, children's stories — plus everything the community publishes.",
    href: "/store",
    cta: "Browse the store",
  },
  {
    icon: Sparkles,
    title: "The AI Studio",
    body: "Describe an idea and your AI co-writer drafts real chapters while you talk. Speak it aloud, upload a document to build on, then revise and restructure on request. You stay the author.",
    href: "/products#studio",
    cta: "See how it writes",
  },
  {
    icon: BookOpenText,
    title: "The Reader",
    body: "Paper-warm reading with a contents sidebar, four highlight colours, and your place saved on every device — plus narrated audiobooks that follow the text as they read.",
    href: "/products#reader",
    cta: "Inside the reader",
  },
  {
    icon: Plug,
    title: "The Claude connector",
    body: "Add Lectoire to Claude and manage your whole library from chat — create books, write chapters, publish — on your own Claude plan.",
    href: "/products#connector",
    cta: "Connect Claude",
  },
  {
    icon: MonitorSmartphone,
    title: "Install anywhere",
    body: "Lectoire installs from the browser on iPhone, Android, Mac and Windows — its own window, no app store, always up to date.",
    href: "/install",
    cta: "Install the app",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Tell the Studio your idea",
    body: "A novel, a field guide, a children's story — describe it in a sentence and start talking.",
  },
  {
    n: "2",
    title: "Watch real chapters appear",
    body: "Your AI partner designs the book and writes it chapter by chapter, taking your direction as it goes.",
  },
  {
    n: "3",
    title: "Publish, listen, or print",
    body: "Share it on the store, have it narrated, export six formats, or order a paperback to your door.",
  },
];

export default async function Landing() {
  const user = await getVerifiedUser();

  return (
    <>
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-16 pb-16 text-center sm:pt-24">
        <p className="mb-5 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          Read · Listen · Create
        </p>
        <h1 className="font-display text-5xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
          Every book you love.
          <br />
          <span className="text-accent">And the ones you haven&apos;t written yet.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Lectoire is a home for books — browse the store, build your library, listen
          to real narration, and write your own books with an AI partner that drafts
          chapters while you talk.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={user ? "/studio" : "/register"}
            className="cursor-pointer rounded-full bg-accent px-7 py-3 text-base font-semibold text-white shadow-book-sm transition-all hover:bg-accent-deep hover:shadow-book"
          >
            {user ? "Open the Studio" : "Start your first book"}
          </Link>
          <Link
            href="/store"
            className="cursor-pointer rounded-full border border-line bg-surface px-7 py-3 text-base font-semibold text-ink transition-colors hover:bg-raised"
          >
            Browse the store
          </Link>
        </div>
      </section>

      {/* What we make */}
      <section id="products" className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
          Everything Lectoire makes
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-muted">
          Five products, one library. From the first spark of an idea to a narrated
          audiobook or a paperback on your shelf.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_CARDS.map((p) => (
            <div
              key={p.title}
              className="flex flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-book-sm transition-shadow hover:shadow-book"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft">
                <p.icon className="h-5 w-5 text-accent-deep" />
              </span>
              <h3 className="font-display text-base font-semibold">{p.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{p.body}</p>
              <Link
                href={p.href}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-accent-deep transition-colors hover:text-accent"
              >
                {p.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How the Studio works */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
            Your first book in three steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="font-display mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-accent text-lg font-semibold text-white shadow-book-sm">
                  {s.n}
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps & connector */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
          Lectoire, wherever you write
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-muted">
          In your browser, installed on any device, or inside Claude — the same
          library, the same books, everywhere.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <AppCard
            icon={MonitorSmartphone}
            title="Install on any device"
            detail="iPhone · Android · Mac · Windows"
            body="Add Lectoire from your browser and it opens in its own window — full-screen reading, your shelves signed in, no app store and nothing to update."
            href="/install"
            cta="Install the app"
          />
          <AppCard
            icon={Plug}
            title="The Claude connector"
            detail="MCP · works in claude.ai, Desktop & Code"
            body="Paste one link into Claude and your library is there: create books, write chapters, edit and publish from chat."
            href="/products#connector"
            cta="Set up the connector"
            accent
          />
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-t border-line bg-surface/60 scroll-mt-20"
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:px-10">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
            One plan, everything included
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-muted">
            Join free and start reading today. When you&apos;re ready to write — or want
            the whole store — there&apos;s just one simple plan.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
            {/* Free tier */}
            <div className="rounded-3xl border border-line bg-surface p-7 shadow-book-sm">
              <h3 className="font-display text-xl font-semibold">Free</h3>
              <p className="font-display mt-2 text-3xl font-semibold">
                $0<span className="text-base font-normal text-muted">/forever</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm leading-snug">
                {[
                  "Browse the full store",
                  "Read all free-flagged books",
                  "Your personal library & shelves",
                  "Highlights and reading progress",
                  "Order printed copies of any book",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/store" : "/register"}
                className="mt-7 block cursor-pointer rounded-full border border-line bg-paper px-6 py-2.5 text-center text-sm font-semibold transition-colors hover:bg-raised"
              >
                {user ? "Browse the store" : "Join free"}
              </Link>
            </div>

            {/* Plus tier */}
            <div className="relative rounded-3xl border-2 border-accent bg-surface p-7 shadow-book">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                Most popular
              </span>
              <h3 className="font-display text-xl font-semibold">{PLAN.name}</h3>
              <p className="font-display mt-2 text-3xl font-semibold">
                {formatPlanPrice().split("/")[0]}
                <span className="text-base font-normal text-muted">/{PLAN.interval}</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm leading-snug">
                {["Everything in Free", ...PLAN.features.slice(0, 4), "Cancel anytime"].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Link
                href={user ? "/plus" : "/register"}
                className="mt-7 block cursor-pointer rounded-full bg-accent px-6 py-2.5 text-center text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
              >
                Get {PLAN.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
          Resources
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-muted">
          Guides, documentation and the details behind how Lectoire works.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {RESOURCES.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              target={r.external ? "_blank" : undefined}
              rel={r.external ? "noreferrer" : undefined}
              className="group cursor-pointer rounded-2xl border border-line bg-surface p-5 shadow-book-sm transition-shadow hover:shadow-book"
            >
              <h3 className="font-display flex items-center gap-1.5 text-base font-semibold">
                {r.title}
                <ArrowRight className="h-3.5 w-3.5 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{r.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Print callout */}
      <section className="border-t border-line bg-surface/60">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-16 text-center sm:px-10">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft">
            <Package className="h-6 w-6 text-accent-deep" />
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Your words, in your hands
          </h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
            Every book on Lectoire — including the ones you write — can be downloaded
            in six formats or ordered as a printed paperback, delivered to your address.
          </p>
          <Link
            href={user ? "/studio" : "/register"}
            className="mt-7 cursor-pointer rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            {user ? "Write your next book" : "Create your account"}
          </Link>
        </div>
      </section>
    </>
  );
}

function AppCard({
  icon: Icon,
  title,
  detail,
  body,
  href,
  cta,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  body: string;
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-book-sm ${
        accent ? "border-accent" : "border-line"
      }`}
    >
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft">
        <Icon className="h-5 w-5 text-accent-deep" />
      </span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs font-medium tracking-wide text-faint uppercase">{detail}</p>
      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
      >
        {cta}
      </Link>
    </div>
  );
}
