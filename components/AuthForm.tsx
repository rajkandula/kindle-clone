"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "./Logo";

const FIELD =
  "w-full rounded-xl border bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

/**
 * Password box with a show/hide toggle.
 *
 * The button is type="button" so it never submits the form, and it is
 * aria-labelled rather than relying on the icon alone, since a bare icon
 * tells a screen reader nothing.
 */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  invalid = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  invalid?: boolean;
  /** Extra content under the field, e.g. a mismatch hint. */
  children?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      {/* Empty when the caller renders its own header row (login pairs the
          label with a "Forgot password?" link), so don't leave a blank gap. */}
      {label && (
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          autoComplete={autoComplete}
          placeholder={placeholder}
          // Room on the right so long passwords never run under the button.
          className={`${FIELD} pr-11 ${invalid ? "border-red-300" : "border-line"}`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-ink"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {children}
    </label>
  );
}

export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "register";
  /** Same-site path to return to after auth (e.g. an OAuth consent screen). */
  next?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  /** Launch spots left, so the offer is never advertised after it's gone. */
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== "register") return;
    fetch("/api/founding")
      .then((r) => r.json())
      .then((d) => setSpotsLeft(typeof d.remaining === "number" ? d.remaining : null))
      .catch(() => setSpotsLeft(null));
  }, [mode]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords don't match — please retype them.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? { name, username, email, password }
            : { identifier: username, password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-3 h-12 w-12 drop-shadow-sm" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "login"
              ? "Sign in to your library and studio."
              : "A library and a writing studio, in one place."}
          </p>
          {mode === "register" && spotsLeft !== null && spotsLeft > 0 && (
            <p className="mt-3 rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-[13px] font-medium text-accent-deep">
              {spotsLeft === 1
                ? "One launch spot left — join now and Plus is free for a month"
                : `First ${spotsLeft} to join get Lectoire Plus free for a month`}
            </p>
          )}
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-book-sm"
        >
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Your full name"
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              {mode === "login" ? "Username or email" : "Username"}
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              // On sign-in the same box takes an email, so the username
              // pattern and length caps must not apply.
              {...(mode === "register"
                ? {
                    minLength: 3,
                    maxLength: 20,
                    pattern: "[a-z0-9_.]{3,20}",
                    title: "3-20 characters: lowercase letters, numbers, _ or .",
                  }
                : { maxLength: 200 })}
              placeholder={mode === "login" ? "you@example.com or username" : "Pick a username"}
              autoComplete={mode === "login" ? "username" : "off"}
              autoCapitalize="none"
              autoCorrect="off"
              className={`${FIELD} border-line`}
            />
          </label>
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={200}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                className={`${FIELD} border-line`}
              />
              <span className="mt-1 block text-xs text-muted">
                Used to sign in and to recover your account.
              </span>
            </label>
          )}
          <div>
            {mode === "login" && (
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Password
                </span>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}
            <PasswordField
              label={mode === "login" ? "" : "Password"}
              value={password}
              onChange={setPassword}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
            />
          </div>
          {mode === "register" && (
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Retype your password"
              invalid={Boolean(confirmPassword) && confirmPassword !== password}
            >
              {confirmPassword && confirmPassword !== password && (
                <span className="mt-1 block text-xs text-red-600">
                  Passwords don&apos;t match yet.
                </span>
              )}
            </PasswordField>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              New to Lectoire?{" "}
              <Link
                href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
                className="font-medium text-accent hover:underline"
              >
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className="font-medium text-accent hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
