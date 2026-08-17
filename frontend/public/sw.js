/* Offline cache: app shell + images (cache-first), other GETs network-first. */
const CACHE = "sumut-v2";
const IMG_HOSTS = ["images.unsplash.com", "images.pexels.com", "unpkg.com"];

self.addEventListener("install", (e) => {
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

function isImage(req, url) {
  return (
    req.destination === "image" ||
    IMG_HOSTS.some((h) => url.hostname.includes(h)) ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname) ||
    url.pathname.includes("/api/files/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Images: cache-first
  if (isImage(req, url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
              return res;
            })
            .catch(() => hit)
      )
    );
    return;
  }

  // Never intercept API calls (except served files/images) — let them fail offline
  // so the app can fall back to its localStorage cache and show the offline banner.
  if (url.pathname.startsWith("/api/") && !url.pathname.includes("/api/files/")) return;

  // App shell / static assets: network-first with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
    );
  }
});
