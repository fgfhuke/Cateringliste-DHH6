// ══ CATERING SERVICE WORKER ══════════════════════════════
const CACHE_NAME = "catering-v2";
const ASSETS = [
  "./",
  "./index.html",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];

// Installation: Assets cachen
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // index.html immer cachen, externe Ressourcen optional
      return cache.add("./index.html").then(() => {
        return Promise.allSettled(
          ASSETS.slice(1).map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Aktivierung: alten Cache löschen
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First für App-Assets, Network-First für API
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Google Apps Script API → immer Network, nie cachen
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

  // Google Fonts → Network mit Cache-Fallback
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached || new Response("", {status: 503}));
      })
    );
    return;
  }

  // App-Assets (index.html, sw.js, Icon) → Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Im Hintergrund aktualisieren (Stale-While-Revalidate)
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // Nicht im Cache → Network
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        // Komplett offline → index.html ausliefern
        caches.match("./index.html")
      );
    })
  );
});
