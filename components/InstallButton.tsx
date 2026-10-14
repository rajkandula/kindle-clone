"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Download, Share, SquarePlus } from "lucide-react";

/** Chromium fires this before showing its own install UI; not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type State = "checking" | "installed" | "ready" | "ios" | "manual";

/**
 * One control that does the right thing per device: a real install button
 * where the browser offers one, Safari's Share → Add to Home Screen steps on
 * iPhone and iPad (the only route Apple allows), and menu directions elsewhere.
 */
export function InstallButton() {
  const [state, setState] = useState<State>("checking");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setState("installed");
      return;
    }
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac; touch points give it away.
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setState(isIOS ? "ios" : "manual");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setState("ready");
    };
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setState("installed");
    setDeferred(null);
  }

  if (state === "installed") {
    return (
      <div className="mx-auto mt-10 flex max-w-xl items-start gap-3.5 rounded-3xl border border-line bg-surface p-6 shadow-book-sm">
        <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
        <div>
          <p className="font-display text-lg font-semibold">Lectoire is installed</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">
            Open it from your home screen or dock — it signs in with the same account.
          </p>
        </div>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="mt-10 text-center">
        <button
          onClick={install}
          className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-book-sm transition-colors hover:bg-accent-deep"
        >
          <Download className="h-5 w-5" />
          Install Lectoire
        </button>
        <p className="mt-3 text-sm text-muted">Free · takes a second · no app store</p>
      </div>
    );
  }

  if (state === "ios") {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-book-sm">
        <p className="font-display text-lg font-semibold">Install on iPhone or iPad</p>
        <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
          <li className="flex items-start gap-3">
            <span className="font-display font-semibold text-accent-deep">1.</span>
            <span>
              Tap <Share className="mx-0.5 inline h-4 w-4 align-[-2px] text-ink" aria-label="Share" /> Share at the
              bottom of Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-display font-semibold text-accent-deep">2.</span>
            <span>
              Choose <SquarePlus className="mx-0.5 inline h-4 w-4 align-[-2px] text-ink" aria-hidden="true" />{" "}
              <strong className="font-semibold text-ink">Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-display font-semibold text-accent-deep">3.</span>
            <span>
              Tap <strong className="font-semibold text-ink">Add</strong>. Lectoire appears beside your other apps.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-faint">
          Safari only — Apple doesn&apos;t let other iPhone browsers install apps.
        </p>
      </div>
    );
  }

  // "manual" and the brief "checking" moment share one layout, so nothing jumps.
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-book-sm">
      <p className="font-display text-lg font-semibold">Install from your browser</p>
      <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-muted">
        <li>
          <strong className="font-semibold text-ink">Chrome or Edge:</strong>{" "}click the install icon at the right of
          the address bar, or open the menu and choose{" "}
          <strong className="font-semibold text-ink">Install Lectoire</strong>.
        </li>
        <li>
          <strong className="font-semibold text-ink">Safari on Mac:</strong>{" "}File →{" "}
          <strong className="font-semibold text-ink">Add to Dock</strong>.
        </li>
        <li>
          <strong className="font-semibold text-ink">Firefox:</strong>{" "}can&apos;t install web apps yet — keep reading
          in the tab, or use one of the browsers above for the app.
        </li>
      </ul>
    </div>
  );
}
