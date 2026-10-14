// Makes Lectoire installable on browsers that still want a service worker.
// It deliberately caches nothing: books, reading progress and the Studio are
// live data, and a stale shell would be worse than no offline mode. Offline
// reading is a separate, deliberate step.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
