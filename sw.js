// Vysti Marker — Service Worker (minimal, network-first)
// Primary purpose: enable PWA installability.  Only caches the three
// app-shell HTML pages as an offline fallback.  All other requests
// (API calls, auth, CDN scripts, etc.) pass through untouched.

const CACHE = "vysti-v1";
const SHELL = new Set([
  "/teacher_react.html",
  "/student_react.html",
  "/write_react.html",
]);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...SHELL])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Only handle same-origin navigation requests for cached shell pages.
  // Everything else (API, auth, CDN, supabase) passes through to the
  // network without any SW interference.
  const url = new URL(e.request.url);
  if (e.request.mode !== "navigate") return;
  if (url.origin !== self.location.origin) return;
  if (!SHELL.has(url.pathname)) return;

  // Network-first for shell pages only — fall back to cache if offline.
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
