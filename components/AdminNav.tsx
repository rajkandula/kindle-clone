"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Banknote,
  Gem,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Users,
} from "lucide-react";

const SECTIONS: {
  heading: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    heading: "Money",
    items: [
      { label: "Revenue", href: "/admin/revenue", icon: Banknote },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: Gem },
      { label: "Orders", href: "/admin/orders", icon: Package },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      { label: "Creators", href: "/admin/creators", icon: Users },
      { label: "Books", href: "/admin/books", icon: BookMarked },
    ],
  },
  {
    heading: "People",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Messages", href: "/admin/messages", icon: MessageSquareText },
    ],
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/**
 * The desktop rail.
 *
 * Kept separate from the mobile strip because the two belong in different
 * places in the layout: the rail is a column beside the content, the strip sits
 * above it. Rendering both inside the row made the strip a flex sibling and it
 * stretched to the full page height.
 */
export function AdminRail() {
  const isActive = useIsActive();
  return (
    <>
      <aside className="hidden w-52 shrink-0 lg:block">
        <nav className="sticky top-6 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
                {section.heading}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-ink text-white shadow-book-sm"
                        : "text-ink hover:bg-raised"
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${isActive(item.href) ? "text-white" : "text-muted"}`}
                    />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

/** The small-screen strip, rendered above the content. */
export function AdminNav() {
  const isActive = useIsActive();
  return (
    <>
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden thin-scrollbar">
        {SECTIONS.flatMap((s) => s.items).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isActive(item.href) ? "bg-ink text-white" : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
