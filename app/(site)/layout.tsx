import { getVerifiedUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The public site: landing page, product pages, contact and legal.
 *
 * Everything here is readable whether or not you're signed in — the session is
 * only used to decide what the header offers, never to redirect anyone away.
 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getVerifiedUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
