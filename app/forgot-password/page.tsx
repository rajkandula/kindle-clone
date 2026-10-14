import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Reset your password" };

/**
 * Password recovery.
 *
 * Deliberately does NOT pretend to send an email. The app has no mail
 * provider configured, so a form that said "check your inbox" would strand
 * every user who used it. Until a provider is wired up, this tells the truth
 * and gives people a route that actually works.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-3 h-12 w-12 drop-shadow-sm" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll get you back into your library.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
          <p className="text-sm leading-relaxed text-muted">
            Automatic password reset isn&apos;t switched on yet.{" "}
            {CONTACT_EMAIL ? (
              <>
                Email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Password%20reset`}
                  className="font-medium text-accent hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
              </>
            ) : (
              <>
                Write to us through the{" "}
                <Link href="/contact" className="font-medium text-accent hover:underline">
                  contact form
                </Link>{" "}
              </>
            )}
            from the address on your account and we&apos;ll reset it for you.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Include your username so we can find the account quickly.
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
