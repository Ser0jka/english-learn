/* The build replaces version and asset list. API requests and user progress never enter this cache. */
const VERSION = "__VERSION__";
const SHELL = "lexi-shell-" + VERSION;
const DATA = "lexi-data-__DATA_VERSION__";
const PRECACHE = ["__PRECACHE__"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("lexi-") && name !== SHELL && name !== DATA,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api")
  )
    return;
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA);
        try {
          const response = await fetch(req);
          if (response.ok) await cache.put(req, response.clone());
          return response;
        } catch {
          const saved = await cache.match(req);
          if (saved) return saved;
          return new Response("Этот словарь ещё не был открыт на устройстве.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () =>
        (await caches.open(SHELL))
          .match("/index.html")
          .then((response) => response || Response.error()),
      ),
    );
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(SHELL)
        .then(async (cache) => (await cache.match(url.pathname)) || fetch(req)),
    );
  }
});
