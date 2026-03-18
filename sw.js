// ══ CATERING SERVICE WORKER v4 ══════════════════════════
// Strategie: index.html cachen ABER im Hintergrund immer aktualisieren
const CACHE_NAME = "catering-v4";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // index.html und externe Libs beim ersten Laden cachen
      Promise.allSettled([
        cache.add("./index.html"),
        cache.add("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
        cache.add("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js")
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Google Apps Script API → immer Network
  if (url.hostname.includes("script.google.com")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ok:false, error:"Offline"}), {
          headers: {"Content-Type": "application/json"}
        })
      )
    );
    return;
  }

  // index.html → Stale-While-Revalidate
  // Sofort aus Cache liefern, im Hintergrund aktualisieren
  if (url.pathname.endsWith("/") || url.pathname.endsWith("index.html") || url.pathname === "/Cateringliste-DHH6/") {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match("./index.html").then(cached => {
          // Im Hintergrund aktualisieren wenn online
          const fetchPromise = fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put("./index.html", response.clone());
            }
            return response;
          }).catch(() => null);

          // Gecachte Version sofort zurückgeben
          // Wenn nicht gecacht → auf Netz warten
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Externe Libs → Cache-First
  if (url.hostname.includes("cdnjs.cloudflare.com") ||
      url.hostname.includes("fonts.googleapis.com") ||
      url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => new Response("", {status: 503}))
      )
    );
    return;
  }

  // Alles andere → Network mit Cache-Fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
