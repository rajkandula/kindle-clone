import Link from "next/link";
import { Logo } from "./Logo";
import { CONTACT_EMAIL } from "@/lib/site";

const COLUMNS: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { label: "Book Store", href: "/store" },
        { label: "AI Studio", href: "/products#studio" },
        { label: "The Reader", href: "/products#reader" },
        { label: "Lectoire Plus", href: "/#pricing" },
        { label: "Printed books", href: "/products#print" },
      ],
    },
    {
      heading: "Apps & Claude",
      links: [
        { label: "Install the app", href: "/install" },
        { label: "Claude connector", href: "/products#connector" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "All products", href: "/products" },
        { label: "Export formats", href: "/products#formats" },
        { label: "Manage connections", href: "/connections" },
        { label: "Contact us", href: "/contact" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms" },
        ...(CONTACT_EMAIL
          ? [{ label: `Email ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}`, external: true }]
          : []),
      ],
    },
  ];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/50">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-7" />
              <span className="font-display text-base font-semibold">Lectoire</span>
            </div>
            <p className="mt-3 max-w-[15rem] text-sm leading-relaxed text-muted">
              A home for books — read them, write them, listen to them, and hold them
              in your hands.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                {col.heading}
              </p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noreferrer" : undefined}
                      className="cursor-pointer text-sm text-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} Lectoire. All rights reserved.
          </p>
          <nav className="flex items-center gap-5 text-xs text-muted">
            <Link href="/privacy" className="cursor-pointer transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="cursor-pointer transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/contact" className="cursor-pointer transition-colors hover:text-ink">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
