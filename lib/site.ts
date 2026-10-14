/**
 * Everything the public site advertises, in one place.
 *
 * The marketing header, footer and product pages all read from here so a new
 * product or a shipped download only has to be described once.
 */

/**
 * Where Lectoire actually lives, whatever host you happen to be browsing.
 * Env-driven so staging or a future move is a config change, not a code edit.
 * Set NEXT_PUBLIC_ORIGIN (inlined at build time) to your public URL in
 * production; the localhost default only suits local development.
 */
export const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000").replace(
  /\/$/,
  ""
);

/** The connector URL people paste into Claude to reach their library. */
export const MCP_URL = `${PUBLIC_ORIGIN}/api/mcp`;

export interface ProductLink {
  title: string;
  href: string;
  blurb: string;
  /** lucide icon name, resolved by the component that renders it */
  icon: "store" | "sparkles" | "book" | "plug" | "install" | "package";
}

/** The things Lectoire actually ships — shown in the header menu and on /products. */
export const PRODUCTS: ProductLink[] = [
  {
    title: "Book Store",
    href: "/store",
    blurb: "Original books in every genre, plus everything the community publishes.",
    icon: "store",
  },
  {
    title: "AI Studio",
    href: "/products#studio",
    blurb: "Describe an idea and write real chapters with an AI partner — by voice or by typing.",
    icon: "sparkles",
  },
  {
    title: "The Reader",
    href: "/products#reader",
    blurb: "Paper-warm reading with highlights, saved progress, and narrated audiobooks.",
    icon: "book",
  },
  {
    title: "Claude connector",
    href: "/products#connector",
    blurb: "Manage your whole library from Claude — create, write, and publish from chat.",
    icon: "plug",
  },
  {
    title: "Install the app",
    href: "/install",
    blurb: "Lectoire on your phone, tablet or desktop — installed from the browser, no app store.",
    icon: "install",
  },
];

export interface ResourceLink {
  title: string;
  href: string;
  blurb: string;
  external?: boolean;
}

export const RESOURCES: ResourceLink[] = [
  {
    title: "Connect Claude to Lectoire",
    href: "/connections",
    blurb: "Generate a connector link and manage the apps that can reach your library.",
  },
  {
    title: "Export & print formats",
    href: "/products#formats",
    blurb: "What's inside a download, and how printed paperbacks are made.",
  },
  {
    title: "Contact us",
    href: "/contact",
    blurb: "Questions, bug reports, press, or partnership — a person reads every message.",
  },
];

export const LEGAL_UPDATED = "7 August 2026";

/**
 * The public contact address shown in the footer and legal pages, and the
 * default recipient of team alerts. Empty by default: set CONTACT_EMAIL to
 * your own inbox, and pages fall back to the contact form until you do.
 */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "";

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

/**
 * The invitation people send.
 *
 * Short on purpose. A long description of everything Lectoire does reads as an
 * advert and gets skimmed; a warm two-line welcome and a link gets opened.
 */
export function inviteMessage(link: string): string {
  return `Welcome to Lectoire — a home for books. Enjoy creating and reading books.

The first ten people to join get Lectoire Plus free for a month.

${link}`;
}

/** A shareable link that credits whoever sent it. */
export function inviteLink(username?: string): string {
  return username ? `${PUBLIC_ORIGIN}/?invite=${encodeURIComponent(username)}` : PUBLIC_ORIGIN;
}
