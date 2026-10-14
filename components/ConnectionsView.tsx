"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PUBLIC_ORIGIN } from "@/lib/site";

export interface OAuthGrantLite {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * The Lectoire connector: a personal MCP server URL + access token that lets
 * Claude (Claude Code, Claude Desktop, or a claude.ai connector) manage the
 * user's Lectoire library from chat. claude.ai connects via OAuth instead —
 * approved apps show up in the "Connected Claude apps" list.
 */
export function ConnectionsView({
  initialMcpToken,
  grants,
}: {
  initialMcpToken: string;
  grants: OAuthGrantLite[];
}) {
  const router = useRouter();
  const [mcpToken, setMcpToken] = useState(initialMcpToken);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantBusy, setGrantBusy] = useState<string | null>(null);

  async function disconnect(grant: OAuthGrantLite) {
    if (grantBusy) return;
    if (!window.confirm(`Disconnect "${grant.clientName}"? It loses access immediately.`)) return;
    setGrantBusy(grant.id);
    try {
      const res = await fetch(`/api/oauth/grants/${grant.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setGrantBusy(null);
    }
  }

  useEffect(() => {
    // Claude reaches this URL from its own servers, so it has to be the public
    // address — a localhost origin (a dev server, or an app window pointed at
    // one) is unreachable and would give everyone a connector that can't connect.
    const here = window.location.origin;
    const reachable = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(here);
    setOrigin(reachable ? here : PUBLIC_ORIGIN);
  }, []);

  async function generateToken() {
    if (busy) return;
    if (
      mcpToken &&
      !window.confirm("Rotate the token? Clients using the old one stop working.")
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/mcp-token", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMcpToken(data.token);
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken() {
    if (busy) return;
    if (!window.confirm("Revoke the token? Connected Claude clients stop working.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/mcp-token", { method: "DELETE" });
      if (res.ok) setMcpToken("");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:px-10">
      <Link
        href="/studio"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Studio
      </Link>
      <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">
        Claude connector
      </p>
      <h1 className="font-display mb-2 text-4xl font-semibold tracking-tight">
        Connect Claude to Lectoire
      </h1>
      <p className="mb-8 max-w-xl text-sm leading-relaxed text-muted">
        Give Claude (Claude Code, Claude Desktop, or a claude.ai connector) access
        to <em>your</em> Lectoire library. Chat with Claude to create books, write
        and refine chapters, publish to the store — on your Claude subscription.
      </p>

      {/* claude.ai connect (OAuth) */}
      <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-4.5 w-4.5 text-accent" /> Connect on claude.ai
        </h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
          In claude.ai go to <span className="font-medium text-ink">Settings → Connectors →
          Add custom connector</span>, paste the server URL below, and click{" "}
          <span className="font-medium text-ink">Connect</span>. Lectoire will ask you to
          sign in and approve — no tokens to copy.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px]">
            {origin ? `${origin}/api/mcp` : "…/api/mcp"}
          </code>
          <button
            onClick={() => copy(`${origin}/api/mcp`, "oauth-url")}
            aria-label="Copy server URL"
            className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {copied === "oauth-url" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        {grants.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2.5 text-xs font-medium tracking-wide text-muted uppercase">
              Connected Claude apps
            </p>
            <div className="space-y-2">
              {grants.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
                    <Plug className="h-4 w-4 text-accent-deep" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.clientName}</p>
                    <p className="text-xs text-faint">
                      Connected{" "}
                      {new Date(g.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {g.lastUsedAt &&
                        ` · last used ${new Date(g.lastUsedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}`}
                    </p>
                  </div>
                  <button
                    onClick={() => disconnect(g)}
                    disabled={grantBusy !== null}
                    aria-label={`Disconnect ${g.clientName}`}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-faint transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    {grantBusy === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <BookMarked className="h-4.5 w-4.5 text-accent" /> Manual setup (Claude Code &
          Claude Desktop)
        </h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
          For tools configured by hand, use the server URL with a personal access token.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
              Server URL
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                {origin ? `${origin}/api/mcp` : "…/api/mcp"}
              </code>
              <button
                onClick={() => copy(`${origin}/api/mcp`, "url")}
                aria-label="Copy server URL"
                className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                {copied === "url" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
              Access token
            </p>
            {mcpToken ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                  {mcpToken}
                </code>
                <button
                  onClick={() => copy(mcpToken, "token")}
                  aria-label="Copy access token"
                  className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  {copied === "token" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={generateToken}
                  disabled={busy}
                  title="Rotate token"
                  aria-label="Rotate token"
                  className="cursor-pointer rounded-lg p-2.5 text-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={revokeToken}
                  disabled={busy}
                  title="Revoke token"
                  aria-label="Revoke token"
                  className="cursor-pointer rounded-lg p-2.5 text-faint transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={generateToken}
                disabled={busy}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate access token
              </button>
            )}
          </div>

          {mcpToken && origin && (
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
                Claude Code setup
              </p>
              <code className="block overflow-x-auto rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12px] whitespace-nowrap">
                claude mcp add --transport http lectoire {origin}/api/mcp -H
                &quot;Authorization: Bearer {mcpToken}&quot;
              </code>
            </div>
          )}

          <p className="text-xs leading-relaxed text-faint">
            The token gives full access to your library — treat it like a password.
            Rotate or revoke it here anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
