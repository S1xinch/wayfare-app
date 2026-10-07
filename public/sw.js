// Offline support. Caches only public, non-personal content:
//  - static assets (cache-first)
//  - flight search results the user has already seen (/api/search 200s), so they can be re-opened offline
//  - the results / privacy / terms pages and an /offline fallback
//  - the /trips shell: every /trips/* navigation shares one cached copy (the page is a client-rendered shell; trip data lives in IndexedDB)
// Never cached: accounts, alerts, bookings, anything under /api/ other than search results, or personalised pages.
const V = "ff-v1";
const STATIC = `${V}-static`;
const PAGES = `${V}-pages`;
const API = `${V}-api`;
const CACHEABLE_PAGES = ["/results", "/privacy", "/terms", "/offline"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/offline"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ff-") && !k.startsWith(V)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Search results are keyed without the polling id, so a finished search is found by its route and dates.
const searchKey = (url) => {
  const u = new URL(url);
  u.searchParams.delete("snap");
  return u.toString();
};

async function networkFirst(req, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.status === 200) await cache.put(key ?? req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key ?? req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname === "/api/search") {
    e.respondWith(
      networkFirst(req, API, searchKey(req.url)).catch(
        () => new Response(JSON.stringify({ error: "You are offline and this search was not saved on this device." }), { status: 503, headers: { "Content-Type": "application/json" } }),
      ),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => (res.ok && c.put(req, res.clone()), res))),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname.startsWith("/trips")) {
    // Cached under one key so any trip URL opens offline; the shell holds no personal data beyond the Sign in / Dashboard link.
    e.respondWith(networkFirst(req, PAGES, "/trips").catch(async () => (await caches.match("/trips")) ?? (await caches.match("/offline")) ?? Response.error()));
    return;
  }

  if (req.mode === "navigate") {
    const cacheable = CACHEABLE_PAGES.includes(url.pathname);
    e.respondWith(
      (cacheable ? networkFirst(req, PAGES) : fetch(req)).catch(async () => (await caches.match("/offline")) ?? Response.error()),
    );
  }
});
