/* Alpha-O service worker: app shell works offline; chat/API requests are never cached. */
const VERSION = "alpha-o-v5";
const scopeUrl = new URL(self.registration.scope);
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "favicon.png",
  "components/sidebar.html", "components/chat.html", "components/settings.html", "components/dialogs.html",
  "components/app-updates.html", "components/voice-mode.html", "components/robot-3d.html", "components/read-aloud.html",
  "components/automate.html", "components/startup.html", "components/chat-extras.html", "components/voice-extras.html",
  "components/voice-plus.html"
].map(path => new URL(path, scopeUrl).href);
const INDEX_URL = new URL("index.html", scopeUrl).href;
const ROOT_URL = scopeUrl.href;
const CDN = ["https://cdnjs.cloudflare.com/"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => Promise.allSettled(SHELL.map(url => cache.add(url)))));
});
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.url.includes("_chk=")) return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = CDN.some(prefix => request.url.startsWith(prefix));
  if (!sameOrigin && !isCdn) return; // AI and analytics requests always go directly to the network.

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(VERSION).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then(response => response || caches.match(INDEX_URL) || caches.match(ROOT_URL)))
    );
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response && (response.ok || response.type === "opaque")) {
        const copy = response.clone();
        caches.open(VERSION).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
