import Link from "next/link";
import { Check, MonitorSmartphone, Plug, Smartphone } from "lucide-react";
import { MCP_URL } from "@/lib/site";
import { InstallButton } from "@/components/InstallButton";

export const metadata = { title: "Install Lectoire" };

const PERKS = [
  "Opens in its own window — no tabs, no address bar",
  "Full-screen, distraction-free reading",
  "Signed in once — your shelves stay put",
  "Updates itself; you always have the latest",
];

const DEVICES = [
  {
    icon: Smartphone,
    title: "iPhone & iPad",
    steps: "In Safari: Share → Add to Home Screen → Add.",
  },
  {
    icon: Smartphone,
    title: "Android",
    steps: "In Chrome: tap Install when it appears, or menu → Install app.",
  },
  {
    icon: MonitorSmartphone,
    title: "Mac, Windows & Chromebook",
    steps: "Chrome or Edge: the install icon in the address bar. Safari: File → Add to Dock.",
  },
];

export default function InstallPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft">
          <MonitorSmartphone className="h-7 w-7 text-accent-deep" />
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Install Lectoire on any device
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Lectoire is a web app you install straight from the browser — iPhone, iPad,
          Android, Mac, Windows, Chromebook. No app store, and it&apos;s always the same
          library.
        </p>
      </div>

      <InstallButton />

      <ul className="mx-auto mt-8 grid max-w-2xl gap-2.5 sm:grid-cols-2">
        {PERKS.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm text-muted">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {DEVICES.map((d) => (
          <div key={d.title} className="rounded-3xl border border-line bg-surface p-6 shadow-book-sm">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft">
              <d.icon className="h-5 w-5 text-accent-deep" />
            </span>
            <h2 className="font-display text-lg font-semibold">{d.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{d.steps}</p>
          </div>
        ))}
      </div>

      {/* Browser */}
      <div className="mt-5 rounded-3xl border border-line bg-surface p-7 shadow-book-sm">
        <h2 className="font-display text-xl font-semibold">Prefer the browser?</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Nothing to install. Lectoire runs fully in the browser on desktop, tablet and
          phone — the same library, reading progress and Studio as the installed app.
        </p>
        <Link
          href="/store"
          className="mt-5 inline-block cursor-pointer rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Open Lectoire in the browser
        </Link>
      </div>

      {/* Claude connector */}
      <div
        id="connector"
        className="mt-5 scroll-mt-20 rounded-3xl border border-accent bg-surface p-7 shadow-book-sm"
      >
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft">
          <Plug className="h-5 w-5 text-accent-deep" />
        </span>
        <h2 className="font-display text-xl font-semibold">Add Lectoire to Claude</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Lectoire is an MCP connector, so Claude can work inside your library: create a
          book, write and edit chapters, browse the store and publish — all from chat, on
          your own Claude plan. Works in claude.ai, Claude Desktop and Claude Code.
        </p>

        <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
          <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
            Connector URL
          </p>
          <code className="mt-1.5 block overflow-x-auto font-mono text-sm break-all text-ink">
            {MCP_URL}
          </code>
        </div>

        <ol className="mt-5 space-y-2.5 text-sm leading-relaxed text-muted">
          <li className="flex gap-3">
            <span className="font-display font-semibold text-accent-deep">1.</span>
            In Claude, open <strong className="font-semibold text-ink">Settings → Connectors</strong>{" "}
            and choose <strong className="font-semibold text-ink">Add custom connector</strong>.
          </li>
          <li className="flex gap-3">
            <span className="font-display font-semibold text-accent-deep">2.</span>
            Paste the URL above and approve the sign-in prompt — it&apos;s your own
            Lectoire account.
          </li>
          <li className="flex gap-3">
            <span className="font-display font-semibold text-accent-deep">3.</span>
            Ask Claude to write you a book. It appears in your library as it&apos;s
            written.
          </li>
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/connections"
            className="cursor-pointer rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Manage your connections
          </Link>
          <Link
            href="/products#connector"
            className="cursor-pointer rounded-full border border-line bg-paper px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
          >
            What Claude can do
          </Link>
        </div>
      </div>
    </div>
  );
}
