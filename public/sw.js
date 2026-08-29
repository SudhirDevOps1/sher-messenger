/* SHER Messenger service worker — deliberately boring.
 *
 * Goals: installable PWA + shell that still opens offline. NON-goals: caching any
 * ciphertext, because a stale encrypted payload is worse than a polite error. All
 * /api/* traffic is network-only and never written to the cache.
 */
const SHELL = "sher-shell-v3";
const ASSETS = ["/", "/guide", "/plan", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(ASSETS).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // never cache the relay: ciphertext must be fresh, and 401/403 bodies must not be replayed
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match("/"))),
  );
});

/* Push payloads are WAKE-UP ONLY: no sender name, no message content, ever. */
self.addEventListener("push", (event) => {
  let title = "New message";
  let body = "You have a new sealed message. Open the app to decrypt it.";
  try {
    const d = event.data ? event.data.json() : {};
    if (d && typeof d.title === "string") title = d.title;
    if (d && typeof d.count === "number" && d.count > 1) body = `${d.count} new sealed messages.`;
  } catch {
    /* keep generic copy */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "sher-msg",
      silent: false,
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
