const CACHE_NAME = "lalapan-legenda-v4";
const APP_FILES = ["./", "./index.html", "./manifest.json", "./icons/icon.jpeg"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_FILES.map(async file => { try { await cache.add(file); } catch (e) { console.warn("Cache gagal:", file, e); } }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("lalapan-legenda-") && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try { const response = await fetch(event.request); if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put("./index.html", response.clone()); } return response; }
      catch (_) { return (await caches.match("./index.html")) || Response.error(); }
    })()); return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request); if (cached) return cached;
    try { const response = await fetch(event.request); if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(event.request, response.clone()); } return response; }
    catch (_) { return Response.error(); }
  })());
});
