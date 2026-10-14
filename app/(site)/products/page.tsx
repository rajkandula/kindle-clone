import Link from "next/link";
import {
  BookOpenText,
  Check,
  FileText,
  Headphones,
  Highlighter,
  Mic,
  MonitorSmartphone,
  Package,
  Plug,
  Sparkles,
  Store,
  Upload,
} from "lucide-react";
import { MCP_URL } from "@/lib/site";

export const metadata = { title: "Products" };

interface Section {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  points: { icon: React.ComponentType<{ className?: string }>; label: string }[];
  cta: { label: string; href: string; external?: boolean };
}

const SECTIONS: Section[] = [
  {
    id: "store",
    icon: Store,
    eyebrow: "Read",
    title: "The Book Store",
    body: "A real bookstore, not a demo. Original books written for Lectoire across thrillers, romance, poetry, history, science and children's stories — alongside everything the community publishes. Add anything to your library, track what you're reading, and pick up on any device.",
    points: [
      { icon: BookOpenText, label: "Every genre, with full chapter previews" },
      { icon: Highlighter, label: "Shelves: Reading Now, Want to Read, Finished" },
      { icon: Check, label: "Free books for everyone; the full store with Plus" },
    ],
    cta: { label: "Browse the store", href: "/store" },
  },
  {
    id: "studio",
    icon: Sparkles,
    eyebrow: "Write",
    title: "The AI Studio",
    body: "Describe a book in a sentence and the Studio designs it, then writes it chapter by chapter while you steer. Talk to it out loud, hand it a document to build from, and revise anything by asking. You keep the byline — it's your book.",
    points: [
      { icon: Mic, label: "Speak your ideas — voice input built into the chat" },
      { icon: Upload, label: "Upload a PDF or Word file to write from" },
      { icon: FileText, label: "A full manual editor whenever you'd rather type" },
    ],
    cta: { label: "Open the Studio", href: "/studio" },
  },
  {
    id: "reader",
    icon: BookOpenText,
    eyebrow: "Enjoy",
    title: "The Reader",
    body: "Paper-warm typography, a contents sidebar, and adjustable text size. Highlight lines in four colours, and your exact place is saved in every book on every device. Narrated books read aloud in a real voice, highlighting each sentence as it goes.",
    points: [
      { icon: Highlighter, label: "Four highlight colours, saved to your account" },
      { icon: Headphones, label: "Studio narration with follow-along text" },
      { icon: Check, label: "Progress and chapter completion tracked automatically" },
    ],
    cta: { label: "Go to your library", href: "/library" },
  },
  {
    id: "connector",
    icon: Plug,
    eyebrow: "Connect",
    title: "The Claude connector",
    body: "Lectoire is an MCP connector, so Claude can work directly inside your library. Ask it to start a book, write the next chapter, revise a scene, or publish when you're happy — all from a chat window, running on your own Claude plan rather than ours.",
    points: [
      { icon: Check, label: "Works in claude.ai, Claude Desktop and Claude Code" },
      { icon: Check, label: "Secure sign-in — you approve access, revoke any time" },
      { icon: Check, label: "Create, write, edit, browse and publish, all supported" },
    ],
    cta: { label: "Set up the connector", href: "/install#connector" },
  },
  {
    id: "apps",
    icon: MonitorSmartphone,
    eyebrow: "Install",
    title: "The app, on every device",
    body: "Lectoire is a web app you install straight from the browser — iPhone, iPad, Android, Mac, Windows, Chromebook. It opens in its own window with no tabs or address bar, signs in once, and updates itself.",
    points: [
      { icon: Check, label: "iPhone & iPad — Share → Add to Home Screen" },
      { icon: Check, label: "Android, Mac & Windows — one tap in Chrome or Edge" },
      { icon: Check, label: "Same account, same library as the web" },
    ],
    cta: { label: "Install Lectoire", href: "/install" },
  },
  {
    id: "print",
    icon: Package,
    eyebrow: "Hold",
    title: "Printed books & exports",
    body: "Any book on Lectoire — including the ones you write — can leave the screen. Download it in six formats with its cover art, or order a printed paperback and we'll produce it and post it to your address.",
    points: [
      { icon: FileText, label: "EPUB, PDF, DOCX, HTML, Markdown and plain text" },
      { icon: Package, label: "Printed paperbacks delivered to your door" },
      { icon: Check, label: "Cover artwork included in every download" },
    ],
    cta: { label: "See your orders", href: "/orders" },
  },
];

export default function ProductsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What Lectoire makes
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          A bookstore, an AI writing studio, a reader with real narration, a Claude
          connector, an installable app, and a printing press. All one account.
        </p>
      </div>

      <div className="mt-16 space-y-5">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-20 rounded-3xl border border-line bg-surface p-7 shadow-book-sm sm:p-9"
          >
            <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
              <div className="lg:w-2/3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft">
                    <s.icon className="h-5 w-5 text-accent-deep" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-accent uppercase">
                      {s.eyebrow}
                    </p>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">
                      {s.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">{s.body}</p>
                <Link
                  href={s.cta.href}
                  target={s.cta.external ? "_blank" : undefined}
                  rel={s.cta.external ? "noreferrer" : undefined}
                  className="mt-6 inline-block cursor-pointer rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
                >
                  {s.cta.label}
                </Link>
              </div>

              <ul className="space-y-3 rounded-2xl border border-line bg-paper p-5 lg:w-1/3">
                {s.points.map((p) => (
                  <li key={p.label} className="flex items-start gap-2.5 text-sm leading-snug">
                    <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {/* Formats detail */}
      <section
        id="formats"
        className="mt-5 scroll-mt-20 rounded-3xl border border-line bg-surface p-7 shadow-book-sm sm:p-9"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What&apos;s inside a download
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Every book downloads as a single ZIP containing the same text in six formats,
          plus the cover artwork as a PNG — so it opens on a Kindle, in Word, in a
          browser, or in any editor you already use.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { f: "EPUB", d: "E-readers and Apple Books" },
            { f: "PDF", d: "Print-ready, fixed layout" },
            { f: "DOCX", d: "Word, Pages, Google Docs" },
            { f: "HTML", d: "Any browser, fully styled" },
            { f: "Markdown", d: "Editors and version control" },
            { f: "TXT", d: "Plain text, anywhere" },
          ].map((x) => (
            <div key={x.f} className="rounded-2xl border border-line bg-paper p-4">
              <p className="font-display text-sm font-semibold">{x.f}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Connector quick reference */}
      <section className="mt-5 rounded-3xl border border-accent bg-surface p-7 shadow-book-sm sm:p-9">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Connect Claude in one step
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Add this as a custom connector in Claude, approve the sign-in, and your library
          is available in chat.
        </p>
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
          <code className="block overflow-x-auto font-mono text-sm break-all">{MCP_URL}</code>
        </div>
        <Link
          href="/install#connector"
          className="mt-6 inline-block cursor-pointer rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Full setup instructions
        </Link>
      </section>
    </div>
  );
}
