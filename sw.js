// Service worker: app-skal caches ved installation, kortfliser caches efterhånden som de vises.
const VERSION = "v35";
const SHELL = `mcapp-shell-${VERSION}`;
const TILES = "mcapp-tiles-2"; // nyt navn: smider evt. afviste Mapbox-fliser fra v18/v19 ud
const MAX_TILES = 1500;

// Værn mod Mapbox-regning: kortbilleder hentet fra Mapbox tælles pr. måned (på denne telefon).
// Over loftet hentes samme kortbillede gratis fra OpenStreetMap i stedet. Mapbox' gratis grænse er
// ca. 200.000 kortbilleder om måneden; loftet er sat til 10 % af det. Samme tæller bruges af appen (app.js).
const FORBRUG = "mcapp-forbrug", FORBRUG_URL = "/__mapbox-forbrug";
const LOFT_FLISER = 20000;
let forbrugKoe = Promise.resolve();
async function forbrug(felt) {
  const c = await caches.open(FORBRUG), m = new Date().toISOString().slice(0, 7);
  let d = { maaned: m, fliser: 0, ruter: 0 };
  try { const r = await c.match(FORBRUG_URL); if (r) { const x = await r.json(); if (x.maaned === m) d = Object.assign(d, x); } } catch { /* tom */ }
  if (felt) { d[felt]++; await c.put(FORBRUG_URL, new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json" } })); }
  return d;
}
const taelFlise = () => (forbrugKoe = forbrugKoe.then(() => forbrug("fliser")).catch(() => {}));

const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "vejr.js",
  "ture.js",
  "ruteplan.js",
  "config.js",
  "undervejs.js",
  "gps.js",
  "data/routes.js",
  "data/geometry.json",
  "data/benzinpris.json",
  "vendor/leaflet.js",
  "vendor/leaflet.css",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  // cache: "reload" springer browserens HTTP-cache over (GitHub Pages sender max-age=600),
  // så en ny version ikke fyldes med gamle filer
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith("mcapp-shell-") && k !== SHELL) || (k.startsWith("mcapp-tiles") && k !== TILES)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Kortfliser: cache først, ellers net (og gem)
  if (url.hostname === "tile.openstreetmap.org" || (url.hostname === "api.mapbox.com" && url.pathname.includes("/tiles/"))) {
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          if (url.hostname === "api.mapbox.com" && (await forbrug()).fliser >= LOFT_FLISER) {
            // Over loftet: samme flise fra OpenStreetMap (gratis), gemt under OSM-adressen
            const z = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)(@2x)?$/);
            if (z) {
              const osm = new Request(`https://tile.openstreetmap.org/${z[1]}/${z[2]}/${z[3]}.png`);
              const gemt = await c.match(osm);
              if (gemt) return gemt;
              const r = await fetch(osm);
              if (r.ok || r.type === "opaque") c.put(osm, r.clone());
              return r;
            }
          }
          // Mapbox-nøglen er låst til appens adresse. Nogle mobilbrowsere sender ikke adressen med på
          // billeder, så service workeren henter selv flisen med hele adressen som referer (og CORS,
          // så en afvisning kan ses og ikke bliver gemt).
          const res = url.hostname === "api.mapbox.com"
            ? await fetch(req.url, { mode: "cors", credentials: "omit", referrer: self.registration.scope, referrerPolicy: "no-referrer-when-downgrade" })
            : await fetch(req);
          if (url.hostname === "api.mapbox.com") taelFlise();
          if (res.ok || res.type === "opaque") { c.put(req, res.clone()); trimTiles(); }
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Egne filer: net først (så opdateringer slår igennem), cache som reserve offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      // "no-cache" = spørg altid serveren (billigt 304 hvis uændret)
      fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
  }
});
