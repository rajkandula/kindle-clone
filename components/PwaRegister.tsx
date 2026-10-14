"use client";

import { useEffect } from "react";

/** Registers the service worker in production. Renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* an uninstallable session is not an error worth surfacing */
    });
  }, []);
  return null;
}
