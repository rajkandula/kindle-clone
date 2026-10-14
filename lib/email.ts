/**
 * Outbound email through Harakumo Mail (./harakumo.ts, one HARAKUMO_API_KEY).
 *
 * Lectoire accounts have no email address — sign-up is a username and a
 * password — so today this is for operational alerts to the team: a contact
 * form message, a paid print order, a card dispute. Every send is fail-soft.
 * An alert that cannot go out must never break the request that raised it.
 */
import { isHarakumoConfigured, sendViaHarakumo } from "./harakumo";
import { CONTACT_EMAIL } from "./site";

/** Display name on every email Lectoire sends. */
const FROM_NAME = "Lectoire";

export interface Email {
  /** Defaults to the team inbox — see adminAddress(). */
  to?: string;
  subject: string;
  text: string;
  html?: string;
  /** Plain address. Set it to the person who wrote in so Reply just works. */
  replyTo?: string;
}

/**
 * Where alerts go: ADMIN_EMAIL if set, else CONTACT_EMAIL. Both default to
 * empty, so a fresh deployment emails nobody until you say who.
 */
export function adminAddress(): string {
  return process.env.ADMIN_EMAIL || CONTACT_EMAIL;
}

let warnedUnconfigured = false;

export async function sendEmail(mail: Email): Promise<boolean> {
  const to = mail.to ?? adminAddress();
  if (!isHarakumoConfigured() || !to) {
    if (!warnedUnconfigured) {
      console.warn("email: HARAKUMO_API_KEY or ADMIN_EMAIL/CONTACT_EMAIL not set — alerts are off");
      warnedUnconfigured = true;
    }
    return false;
  }

  try {
    await sendViaHarakumo({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      fromName: FROM_NAME,
      replyTo: mail.replyTo,
    });
    return true;
  } catch (err) {
    console.error("email: send failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Fire-and-forget alert for request handlers. Never awaited into the response
 * path: the server is a long-lived Node process, so the promise completes
 * after the response has gone out.
 */
export function notifyAdmin(subject: string, text: string, replyTo?: string): void {
  void sendEmail({ subject, text, replyTo });
}
