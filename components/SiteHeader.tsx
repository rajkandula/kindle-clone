"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  ChevronDown,
  Headphones,
  Menu,
  MonitorSmartphone,
  Package,
  Plug,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { PRODUCTS, RESOURCES, type ProductLink } from "@/lib/site";

const ICONS = {
  store: Store,
  sparkles: Sparkles,
  book: BookOpenText,
  plug: Plug,
  install: MonitorSmartphone,
  audio: Headphones,
  package: Package,
} as const;

/**
 * The public site's top bar.
 *
 * Signed-in visitors keep their session — the header simply swaps the
 * sign-in buttons for a way back into the app, so anyone can read about what
 * Lectoire offers without being bounced to their library or logged out.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [openMenu, setOpenMenu] = useState<"products" | "resources" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  /* Click-away and Escape close the dropdowns. */
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div
        ref={barRef}
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo className="h-8 w-8 drop-shadow-sm" />
          <span className="font-display text-lg font-semibold tracking-tight">Lectoire</span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          <MenuButton
            label="Products"
            open={openMenu === "products"}
            onToggle={() => setOpenMenu(openMenu === "products" ? null : "products")}
          />
          <MenuButton
            label="Resources"
            open={openMenu === "resources"}
            onToggle={() => setOpenMenu(openMenu === "resources" ? null : "resources")}
          />
          <TopLink href="/install">Install</TopLink>
          <TopLink href="/#pricing">Pricing</TopLink>
          <TopLink href="/contact">Contact</TopLink>
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
          {signedIn ? (
            <Link
              href="/home"
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Open Lectoire
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Dropdown panels */}
        {openMenu === "products" && (
          <DropdownPanel onNavigate={() => setOpenMenu(null)}>
            <div className="grid gap-1 sm:grid-cols-2">
              {PRODUCTS.map((p) => (
                <ProductRow key={p.title} product={p} onClick={() => setOpenMenu(null)} />
              ))}
            </div>
          </DropdownPanel>
        )}
        {openMenu === "resources" && (
          <DropdownPanel onNavigate={() => setOpenMenu(null)}>
            <div className="grid gap-1">
              {RESOURCES.map((r) => (
                <Link
                  key={r.title}
                  href={r.href}
                  target={r.external ? "_blank" : undefined}
                  rel={r.external ? "noreferrer" : undefined}
                  onClick={() => setOpenMenu(null)}
                  className="cursor-pointer rounded-xl px-3 py-2.5 transition-colors hover:bg-raised"
                >
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{r.blurb}</p>
                </Link>
              ))}
            </div>
          </DropdownPanel>
        )}
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="border-t border-line bg-paper px-5 py-4 lg:hidden">
          <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
            Products
          </p>
          {PRODUCTS.map((p) => (
            <ProductRow key={p.title} product={p} onClick={() => setMobileOpen(false)} />
          ))}
          <p className="mt-3 px-1 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
            Resources
          </p>
          {RESOURCES.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              target={r.external ? "_blank" : undefined}
              rel={r.external ? "noreferrer" : undefined}
              onClick={() => setMobileOpen(false)}
              className="block cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-raised"
            >
              {r.title}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {signedIn ? (
              <Link
                href="/home"
                className="cursor-pointer rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Open Lectoire
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="cursor-pointer rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="cursor-pointer rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function TopLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </Link>
  );
}

function MenuButton({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-raised hover:text-ink ${
        open ? "bg-raised text-ink" : "text-muted"
      }`}
    >
      {label}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function DropdownPanel({
  children,
}: {
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <div className="absolute top-full left-1/2 z-50 w-[min(42rem,calc(100vw-2.5rem))] -translate-x-1/2 pt-2">
      <div className="rounded-2xl border border-line bg-surface p-2.5 shadow-book">{children}</div>
    </div>
  );
}

function ProductRow({ product, onClick }: { product: ProductLink; onClick: () => void }) {
  const Icon = ICONS[product.icon];
  return (
    <Link
      href={product.href}
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-raised"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
        <Icon className="h-4 w-4 text-accent-deep" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{product.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{product.blurb}</span>
      </span>
    </Link>
  );
}
