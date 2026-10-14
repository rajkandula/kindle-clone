"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { inviteMessage, inviteLink } from "@/lib/site";

/**
 * Share Lectoire with someone.
 *
 * One prepared message rather than a choice of them — picking a tone was a
 * decision standing between the user and sharing a link. It stays editable,
 * because a note that sounds like the sender lands better than any copy I write.
 */
export function InviteView({ username }: { username: string }) {
  const link = useMemo(() => inviteLink(username), [username]);
  const [message, setMessage] = useState(() => inviteMessage(link));
  const [copied, setCopied] = useState<"message" | "link" | null>(null);

  async function copy(what: "message" | "link") {
    await navigator.clipboard.writeText(what === "message" ? message : link);
    setCopied(what);
    setTimeout(() => setCopied(null), 2200);
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  async function shareNatively() {
    try {
      await navigator.share({ title: "Lectoire", text: message });
    } catch {
      /* dismissed */
    }
  }

  const encoded = encodeURIComponent(message);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium tracking-wide text-faint uppercase">
            Your invitation
          </p>
          <span className="text-[11px] text-faint">Edit it to sound like you</span>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={13}
          className="w-full resize-y rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed outline-none focus:border-accent"
        />

        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            onClick={() => copy("message")}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            {copied === "message" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === "message" ? "Copied" : "Copy invitation"}
          </button>

          {canShare && (
            <button
              onClick={shareNatively}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}

          <a
            href={`https://wa.me/?text=${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>

          <a
            href={`mailto:?subject=${encodeURIComponent("I think you'd like Lectoire")}&body=${encoded}`}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
          >
            <Mail className="h-4 w-4" />
            Email
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-book-sm">
        <p className="text-[11px] font-medium tracking-wide text-faint uppercase">
          Your referral link
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-paper px-3.5 py-2.5 font-mono text-sm">
            {link}
          </code>
          <button
            onClick={() => copy("link")}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-raised"
          >
            {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Anyone opening this lands on Lectoire and can start reading free books
          straight away — no card needed to look around.
        </p>
      </div>
    </div>
  );
}
