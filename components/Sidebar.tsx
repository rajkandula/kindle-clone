"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import {
  BookOpen,
  CheckCircle2,
  Gem,
  Home,
  Banknote,
  Gift,
  Info,
  Library,
  LogOut,
  Package,
  PenLine,
  Search,
  Shield,
  Sparkles,
  Store,
  ArrowRightCircle,
} from "lucide-react";
import { Logo } from "./Logo";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Matches when pathname starts with this (and optional shelf param matches). */
  match: (pathname: string, shelf: string | null) => boolean;
}

/**
 * The sidebar is grouped by what you came to do: find something, read it, or
 * write one. Everything to do with the account sits below a divider, out of
 * the way of that flow.
 */
const BROWSE: NavItem[] = [
  { label: "Home", href: "/home", icon: Home, match: (p) => p.startsWith("/home") },
  { label: "Search", href: "/search", icon: Search, match: (p) => p.startsWith("/search") },
  { label: "Book Store", href: "/store", icon: Store, match: (p) => p.startsWith("/store") },
];

/** Books you collected. Mirrors the shelf chips on the library page itself. */
const LIBRARY: NavItem[] = [
  {
    label: "All",
    href: "/library",
    icon: Library,
    match: (p, s) => p === "/library" && !s,
  },
  {
    label: "Reading Now",
    href: "/library?shelf=reading",
    icon: BookOpen,
    match: (p, s) => p === "/library" && s === "reading",
  },
  {
    label: "Want to Read",
    href: "/library?shelf=want",
    icon: ArrowRightCircle,
    match: (p, s) => p === "/library" && s === "want",
  },
  {
    label: "Finished",
    href: "/library?shelf=finished",
    icon: CheckCircle2,
    match: (p, s) => p === "/library" && s === "finished",
  },
];

/**
 * Books you wrote. "My Books" is `ownerId: you` — authored work, not collected
 * work — so it belongs beside the Studio that made it and the earnings it
 * produces, telling one story: write it, find it, get paid for it.
 */
const WRITING: NavItem[] = [
  { label: "Studio", href: "/studio", icon: Sparkles, match: (p) => p.startsWith("/studio") },
  {
    label: "My Books",
    href: "/library?shelf=mine",
    icon: PenLine,
    match: (p, s) => p === "/library" && s === "mine",
  },
  { label: "Earnings", href: "/earnings", icon: Banknote, match: (p) => p.startsWith("/earnings") },
];

const ACCOUNT: NavItem[] = [
  { label: "Orders", href: "/orders", icon: Package, match: (p) => p.startsWith("/orders") },
  { label: "Invite a friend", href: "/invite", icon: Gift, match: (p) => p.startsWith("/invite") },
  /* Back out to the public site — signed in the whole way. */
  { label: "About Lectoire", href: "/", icon: Info, match: (p) => p === "/" },
];

/** Subscribers get a way to manage it; everyone else gets the offer. */
const plusItem = (plus: boolean): NavItem => ({
  label: plus ? "Lectoire Plus" : "Upgrade to Plus",
  href: "/plus",
  icon: Gem,
  match: (p) => p.startsWith("/plus"),
});

const ADMIN_ITEM: NavItem = {
  label: "Admin",
  href: "/admin",
  icon: Shield,
  match: (p) => p.startsWith("/admin"),
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
      {children}
    </p>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = item.match(pathname, params.get("shelf"));
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-colors ${
        active ? "bg-ink text-white shadow-book-sm" : "text-ink hover:bg-raised"
      }`}
    >
      <item.icon className={`h-4 w-4 ${active ? "text-white" : "text-muted"}`} />
      {item.label}
    </Link>
  );
}

interface SidebarUser {
  name: string;
  username: string;
  role: "user" | "admin";
  plus: boolean;
}

function SidebarInner({ user }: { user: SidebarUser }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-gradient-to-b from-surface to-paper md:flex">
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        <Logo className="h-8 w-8" />
        <span className="font-display text-lg font-semibold tracking-tight">Lectoire</span>
      </div>

      <nav className="thin-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3">
        {BROWSE.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}

        <SectionLabel>Library</SectionLabel>
        {LIBRARY.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}

        <SectionLabel>Writing</SectionLabel>
        {WRITING.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}

        {/* Account and billing — deliberately below the reading and writing flow. */}
        <div className="mt-5 space-y-0.5 border-t border-line pt-3">
          <NavLink item={plusItem(user.plus)} />
          {ACCOUNT.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </div>

        {/* Staff only, and a different mode entirely — kept apart from the app's own nav. */}
        {user.role === "admin" && (
          <div className="mt-3 border-t border-line pt-3">
            <NavLink item={ADMIN_ITEM} />
          </div>
        )}
      </nav>

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2.5">
        <Link
          href="/profile"
          title="Your profile"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-raised"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-deep">
            {user.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{user.name}</span>
            <span className="block truncate text-[11px] text-muted">@{user.username}</span>
          </span>
        </Link>
        <button
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

/**
 * Slim bottom bar for small screens.
 *
 * Five destinations, chosen rather than derived: a phone bar that mirrored the
 * whole sidebar would be unreadable, and account items are reachable from the
 * profile page.
 */
const MOBILE: { item: NavItem; short: string }[] = [
  { item: BROWSE[0], short: "Home" },
  { item: BROWSE[2], short: "Store" },
  { item: LIBRARY[0], short: "Library" },
  { item: WRITING[0], short: "Studio" },
  { item: BROWSE[1], short: "Search" },
];

function MobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-line bg-surface/95 py-2 backdrop-blur md:hidden">
      {MOBILE.map(({ item, short }) => (
        <MobileLink key={item.label} item={item} short={short} />
      ))}
    </div>
  );
}

function MobileLink({ item, short }: { item: NavItem; short: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = item.match(pathname, params.get("shelf"));
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      <item.icon className="h-5 w-5" />
      {short}
    </Link>
  );
}

export function Sidebar({ user }: { user: SidebarUser }) {
  return (
    <Suspense>
      <SidebarInner user={user} />
      <MobileBar />
    </Suspense>
  );
}
