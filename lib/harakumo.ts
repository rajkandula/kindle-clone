/**
 * Harakumo Mail client — the one transport Lectoire's operational alerts use.
 *
 * POST {HARAKUMO_BASE_URL}/api/mail/send with a bearer HARAKUMO_API_KEY.
 * Add your own domain in Harakumo → Mail to send from it; until then mail goes
 * out from Harakumo's shared no-reply sender under the display name below.
 *
 * Server-side only: never import this from a client component.
 */

const SEND_TIMEOUT_MS = 10_000;

function apiBase(): string {
  return (process.env.HARAKUMO_BASE_URL || "https://harakumo.com").replace(/\/$/, "");
}

export function isHarakumoConfigured(): boolean {
  return Boolean(process.env.HARAKUMO_API_KEY);
}

export interface HarakumoMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Display name on the From line. */
  fromName: string;
  /** One address replies should go to (e.g. the person who wrote in). */
  replyTo?: string;
}

/** Send one email. Throws on any failure; callers decide whether that matters. */
export async function sendViaHarakumo(mail: HarakumoMail): Promise<void> {
  const apiKey = process.env.HARAKUMO_API_KEY;
  if (!apiKey) throw new Error("HARAKUMO_API_KEY is not configured — cannot send email.");

  const res = await fetch(`${apiBase()}/api/mail/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
      fromName: mail.fromName,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: { status?: string; error?: string };
  };
  if (!res.ok) {
    throw new Error(data?.error || `Mail send failed (HTTP ${res.status})`);
  }
  const status = data?.message?.status;
  if (status && status !== "sent" && status !== "queued") {
    throw new Error(data.message?.error || `Mail was not sent (status: ${status})`);
  }
}
