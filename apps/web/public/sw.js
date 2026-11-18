const CACHE_PREFIXES = ["ottline-cache-", "ott-pwa-"];
const CACHE_NAME = "ottline-cache-v7";
const PRECACHE_URLS = [
  // Standalone documents bypass locale redirects and need no Next.js assets.
  "/offline/ko.html",
  "/offline/en.html",
  "/brand/v2/app-icon-192.png",
  "/brand/v2/app-icon-512.png",
  "/brand/v2/app-icon-180.png",
  "/brand/v2/favicon.svg",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map(
            (path) =>
              new Request(new URL(path, self.location.origin), {
                cache: "reload",
              }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isNextRscRequest(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch")
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/") ||
    /^\/(?:ko|en)\/admin(?:\/|$)/.test(url.pathname)
  ) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (url.pathname.startsWith("/og/")) {
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  if (isNextRscRequest(event.request, url)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Prefixless routes use the application's default Korean locale.
          const locale = /^\/en(?:\/|$)/.test(url.pathname) ? "en" : "ko";
          const cache = await caches.open(CACHE_NAME);
          return cache.match(`/offline/${locale}.html`);
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
