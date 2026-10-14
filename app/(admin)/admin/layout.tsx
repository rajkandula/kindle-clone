import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminUser } from "@/lib/auth";
import { AdminNav, AdminRail } from "@/components/AdminNav";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Admin" };

/**
 * The admin portal stands on its own.
 *
 * Deliberately outside the reader layout: the library sidebar — shelves,
 * Studio, Plus — is noise when you're looking at revenue, and having two
 * navigation rails side by side made it unclear which one you were using.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdminUser();
  if (!admin) redirect("/home");

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                Lectoire company
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Admin</h1>
            </div>
          </div>
          <Link
            href="/home"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lectoire
          </Link>
        </div>

        <AdminNav />
        <div className="flex gap-8">
          <AdminRail />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
