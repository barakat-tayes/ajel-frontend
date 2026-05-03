const CACHE_NAME = "ajel-pwa-v4";
const URLS_TO_CACHE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/icon-2000.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      let url;
      try {
        url = new URL(event.request.url);
      } catch {
        return fetch(event.request);
      }

      if (!url.protocol.startsWith("http")) {
        return fetch(event.request);
      }

      // Never cache API responses. Always go to network for live data.
      if (url.pathname.startsWith("/api/")) {
        try {
          return await fetch(event.request);
        } catch {
          return new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const networkRes = await fetch(event.request);

        // Cache only successful same-origin basic responses.
        const sameOrigin = url.origin === self.location.origin;
        const canCache = sameOrigin && networkRes && networkRes.ok && networkRes.type === "basic";
        if (canCache) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkRes.clone());
          } catch {
            // ignore cache write errors (Safari/private mode quirks)
          }
        }

        return networkRes;
      } catch {
        const fallback = await caches.match("/index.html");
        return fallback || new Response("offline", { status: 503 });
      }
    })()
  );
});
