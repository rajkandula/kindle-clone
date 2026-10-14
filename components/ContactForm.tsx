"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function ContactForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send your message — try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
        <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" />
        <h2 className="font-display text-xl font-semibold text-emerald-900">
          Message sent
        </h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-emerald-800">
          Thanks for reaching out, {name.split(" ")[0] || "friend"} — we read every
          message and we&apos;ll get back to you at {email}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-book-sm sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="Jane Reader"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            maxLength={200}
            placeholder="you@example.com"
            className={inputCls}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Subject
        </span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={200}
          placeholder="A question about my order, the Studio, Plus…"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Message
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={5000}
          rows={6}
          placeholder="Tell us what's on your mind — the more detail, the faster we can help."
          className={`${inputCls} resize-y`}
        />
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send message
      </button>
    </form>
  );
}
