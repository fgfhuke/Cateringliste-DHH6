// ══ CATERING SERVICE WORKER v3 ══════════════════════════
const CACHE_NAME = "catering-v3";

// Nur externe Bibliotheken cachen — NICHT index.html
const CACHE_EXTERN = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];

// Installation
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CACHE_EXTERN.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// Aktivierung: alten Cache löschen
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch-Strategie
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

  // index.html → IMMER frisch vom Netz (enthält API-URL!)
  if (url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        // Nur als Notfall-Fallback den Cache nutzen
        caches.match(event.request)
      )
    );
    return;
  }

  // Externe Bibliotheken (jsPDF etc.) → Cache-First
  if (url.hostname.includes("cdnjs.cloudflare.com")) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Google Fonts → Cache-First
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Alles andere (apple-touch-icon etc.) → Network mit Cache-Fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
