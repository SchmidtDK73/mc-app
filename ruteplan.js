"use strict";
/* ===================== Lav min egen rute =====================
   Vælg start og ønsket længde → appen lægger en rundtur.
   Metode: punkter lægges på en cirkel der går gennem startpunktet; ruten beregnes
   på rigtige veje med Mapbox (eller OSRM som reserve). Cirklens størrelse justeres indtil
   længden passer (±10 %). Der prøves nogle varianter, og den med færrest km på
   E-veje (motorvej) og mindst "frem og tilbage" vælges. */

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const MAPBOX = "https://api.mapbox.com/directions/v5/mapbox/driving/";
const VALHALLA = "https://valhalla1.openstreetmap.de/";
const PLAN_KEY = "mcapp.plan";
const UNDERLAG = {
  asfalt: { navn: "Kun asfalt", tekst: "Undgår grusveje helt." },
  "": { navn: "Blandet", tekst: "Mest asfalt, men en kort grusvej kan komme med." },
  grus: { navn: "Gerne grus", tekst: "Søger grusveje, som man må køre på med motorcykel (ifølge OpenStreetMap). Tjek altid skilte." }
};
// Startsteder i Midt- og Nordjylland hvor testkørsler fandt flest grusveje med adgang (OpenStreetMap)
const GRUS_OMRAADER = {
  "Fjerritslev": [57.088, 9.267], "Nørre Vorupør": [56.953, 8.375], "Harboøre": [56.617, 8.176],
  "Thisted": [56.955, 8.691], "Bindslev": [57.542, 10.198], "Hirtshals": [57.591, 9.956],
  "Sæby": [57.335, 10.518], "Dokkedal": [56.904, 10.254], "Fjellerup Strand": [56.515, 10.59],
  "Hald Ege": [56.411, 9.353], "Aars": [56.803, 9.518], "Hobro": [56.639, 9.79]
};
let grusVeje = null; // data/grus.json: [lat, lon, meter, skovvej] for lovlige grus-/skovveje ≥ 300 m
async function hentGrus() {
  if (!grusVeje) grusVeje = (await (await fetch("data/grus.json")).json()).veje;
  return grusVeje;
}

function afstandKm(a, b) {
  return Math.hypot((a[0] - b[0]) * 110.57, (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180));
}

// Flyt rutepunkterne hen på grusveje i nærheden (lange og tætte foretrækkes, skovveje får lidt ekstra),
// og læg en ekstra grusvej ind mellem hvert par punkter
function grusPunkter(start, pts, radius, veje) {
  const brugt = new Set();
  const maks = Math.min(6, Math.max(2, radius * 0.45));
  const naermest = (p) => {
    let bedst = -1, bv = -Infinity;
    for (let i = 0; i < veje.length; i++) {
      const v = veje[i];
      if (brugt.has(i) || Math.abs(v[0] - p[0]) > maks / 110 || Math.abs(v[1] - p[1]) > maks / 60) continue;
      const d = afstandKm(p, v);
      if (d > maks) continue;
      const vaerdi = Math.min(v[2], 3000) / 1000 - d * 0.5 + (v[3] ? 0.5 : 0);
      if (vaerdi > bv) { bv = vaerdi; bedst = i; }
    }
    if (bedst < 0) return p;
    brugt.add(bedst);
    return [veje[bedst][0], veje[bedst][1]];
  };
  const kaede = [start, ...pts, start], ud = [];
  for (let i = 1; i < kaede.length; i++) {
    const a = kaede[i - 1], b = kaede[i];
    ud.push(naermest([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
    if (i < kaede.length - 1) ud.push(naermest(b));
  }
  return ud;
}

// Vejtyper der kan fravælges helt (Mapbox: exclude=…, Valhalla: exclude_…)
const UNDGAA = {
  motorvej: { navn: "Motorvej", mapbox: "motorway", valhalla: "exclude_highways" },
  betaling: { navn: "Betalingsveje", mapbox: "toll", valhalla: "exclude_tolls" },
  faerge: { navn: "Færger", mapbox: "ferry", valhalla: "exclude_ferries" }
};
const valgteUndgaa = (undgaa = {}) => Object.keys(UNDGAA).filter((k) => undgaa[k]);

const GRUS_FLADER = new Set(["compacted", "gravel", "dirt", "path"]);
const RETNINGER = { "": "Tilfældig", N: "Nord", O: "Øst", S: "Syd", V: "Vest" };
const RETNING_GRADER = { N: 0, O: 90, S: 180, V: 270 };
const STILE = {
  "": { navn: "Blandet", ikon: "", tekst: "Den mest direkte rundtur i den ønskede længde." },
  snoet: { navn: "Snoet", ikon: "〰️", tekst: "Vælger forslaget med flest sving pr. km." },
  bakket: { navn: "Bakket", ikon: "⛰️", tekst: "Vælger forslaget med mest op og ned (højdedata fra Open-Meteo)." },
  smaa: { navn: "Små veje", ikon: "🌾", tekst: "Vælger forslaget med mest kørsel på små veje uden rutenummer." }
};
let sidstePlan = null; // senest genererede rute (vises før den evt. gemmes)

function findRoute(id) {
  return ROUTES.find((r) => r.id === id) || (DB.mineRuter || []).find((r) => r.id === id) || (sidstePlan && sidstePlan.id === id ? sidstePlan : null);
}

// Flyt et punkt et antal km i en retning (grader, 0 = nord)
function flyt([lat, lon], km, grader) {
  const R = 6371, d = km / R, b = (grader * Math.PI) / 180, f1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return [(f2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}

function cirkelPunkter(start, radius, retning, n) {
  const centrum = flyt(start, radius, retning);
  const tilbage = (retning + 180) % 360; // vinkel fra centrum tilbage til start
  const pts = [];
  for (let k = 1; k <= n; k++) pts.push(flyt(centrum, radius, tilbage + (k * 360) / (n + 1)));
  return pts;
}

// Ruteberegning: Mapbox når der er en nøgle i config.js, ellers (eller ved fejl) OSRM's demo-server.
// Begge svarer i samme format.
// Mapbox-nøglen er låst til https://schmidtdk73.github.io/mc-app/, så hele adressen skal sendes som referer
// (browsere sender ellers kun domænet).
async function hentRute(base, coords, ekstra) {
  const res = await fetch(`${base}${coords}?overview=full&geometries=geojson&steps=true${ekstra}`,
    { referrerPolicy: "no-referrer-when-downgrade" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Valhalla (OpenStreetMap, FOSSGIS) kan regne for motorcykel, finde grusveje og fortælle vejbelægningen.
async function valhalla(sti, body) {
  const res = await fetch(VALHALLA + sti, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function afkod6(str) {
  const pts = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    pts.push([Math.round(lat / 10) / 1e5, Math.round(lon / 10) / 1e5]);
  }
  return pts;
}

// Én samlet strækning (mellempunkter som "via"), så vejbelægningen kan slås op i ét kald bagefter
async function valhallaRute(punkter, underlag, undgaa) {
  const mc = underlag === "grus" ? { use_trails: 1, use_highways: 0 } : underlag === "asfalt" ? { exclude_unpaved: true, use_highways: 0 } : { use_highways: 0 };
  valgteUndgaa(undgaa).forEach((k) => (mc[UNDGAA[k].valhalla] = true));
  const locations = punkter.map(([lat, lon], i) => ({ lat, lon, type: i === 0 || i === punkter.length - 1 ? "break" : "via" }));
  const d = await valhalla("route", { locations, costing: "motorcycle", costing_options: { motorcycle: mc }, units: "km" });
  if (!d.trip) throw new Error(d.error || "Ingen rute");
  const shape = d.trip.legs[0].shape;
  return { km: d.trip.summary.length, min: d.trip.summary.time / 60, shape, line: afkod6(shape) };
}

// Vejbelægning og vejklasse langs en Valhalla-rute: km grus, km motorvej, andel små veje, km markvej
async function maalUnderlag(r) {
  const t = await valhalla("trace_attributes", {
    encoded_polyline: r.shape, costing: "motorcycle", shape_match: "walk_or_snap", units: "km",
    filters: { attributes: ["edge.surface", "edge.length", "edge.use", "edge.road_class"], action: "include" }
  });
  let grus = 0, e = 0, smaa = 0, spor = 0;
  for (const k of t.edges || []) {
    const l = k.length || 0;
    if (GRUS_FLADER.has(k.surface)) grus += l;
    if (/motorway|trunk/.test(k.road_class)) e += l;
    if (!/motorway|trunk|primary|secondary/.test(k.road_class || "")) smaa += l;
    if (k.use === "track") spor += l;
  }
  Object.assign(r, { grusKm: grus, eKm: e, smaa: smaa / r.km, sporKm: spor });
  return r;
}

async function osrmRute(punkter, underlag = "", undgaa = {}) {
  if (underlag === "grus") return valhallaRute(punkter, "grus", undgaa);
  const exclude = valgteUndgaa(undgaa).map((k) => UNDGAA[k].mapbox).concat(underlag === "asfalt" ? ["unpaved"] : []);
  const coords = punkter.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
  let d;
  if (window.MAPBOX_TOKEN) {
    try { d = await hentRute(MAPBOX, coords, (exclude.length ? "&exclude=" + exclude.join(",") : "") + "&access_token=" + window.MAPBOX_TOKEN); }
    catch (e) { console.warn("Mapbox fejlede, bruger reserve", e); }
  }
  // OSRM's demo kan ikke fravælge noget – så bruges Valhalla som reserve, når der er fravalg
  if ((!d || d.code !== "Ok") && exclude.length) return maalUnderlag(await valhallaRute(punkter, underlag, undgaa));
  if (!d || d.code !== "Ok") d = await hentRute(OSRM, coords, "");
  if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error(d.message || "Ingen rute");
  const r = d.routes[0];
  let eKm = 0, smaaKm = 0;
  r.legs.forEach((leg) => leg.steps.forEach((s) => {
    if (/^E\s?\d/.test(s.ref || "")) eKm += s.distance / 1000;
    if (!s.ref && s.mode !== "ferry") smaaKm += s.distance / 1000;
  }));
  const line = r.geometry.coordinates.map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]);
  return { km: r.distance / 1000, min: r.duration / 60, eKm, smaa: smaaKm / (r.distance / 1000), line };
}

// Sving: summen af retningsskift (3–75° pr. knæk, så kryds ikke tæller) i grader pr. km
function svingPrKm(line) {
  const kx = 111.32 * Math.cos((line[0][0] * Math.PI) / 180), ky = 110.54;
  const pts = [line[0]];
  for (const p of line) { const q = pts[pts.length - 1]; if (Math.hypot((p[1] - q[1]) * kx, (p[0] - q[0]) * ky) > 0.02) pts.push(p); }
  let sum = 0, km = 0;
  for (let i = 1; i < pts.length; i++) {
    km += Math.hypot((pts[i][1] - pts[i - 1][1]) * kx, (pts[i][0] - pts[i - 1][0]) * ky);
    if (i < 2) continue;
    const h1 = Math.atan2((pts[i - 1][1] - pts[i - 2][1]) * kx, (pts[i - 1][0] - pts[i - 2][0]) * ky);
    const h2 = Math.atan2((pts[i][1] - pts[i - 1][1]) * kx, (pts[i][0] - pts[i - 1][0]) * ky);
    let d = Math.abs(((h2 - h1) * 180) / Math.PI);
    if (d > 180) d = 360 - d;
    if (d >= 3 && d <= 75) sum += d;
  }
  return km ? sum / km : 0;
}

// Stigning: samlet opstigning i meter pr. km ud fra 100 højdepunkter langs ruten (Open-Meteo)
async function stigningPrKm(line, km) {
  const n = Math.min(100, line.length);
  const pts = Array.from({ length: n }, (_, i) => line[Math.round((i * (line.length - 1)) / (n - 1))]);
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(4)).join(",")}&longitude=${pts.map((p) => p[1].toFixed(4)).join(",")}`;
  let res = await fetch(url);
  if (!res.ok) { await vent(1500); res = await fetch(url); } // ét nyt forsøg ved travlhed
  if (!res.ok) throw new Error("HTTP " + res.status);
  const h = (await res.json()).elevation || [];
  let op = 0;
  for (let i = 1; i < h.length; i++) if (h[i] - h[i - 1] > 0) op += h[i] - h[i - 1];
  return op / km;
}

// Andel af ruten der køres to gange (frem og tilbage ad samme vej) – lavere er bedre
function gentagelse(line) {
  const seen = new Set();
  let dobbelt = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1].map((v) => v.toFixed(3)).join(), b = line[i].map((v) => v.toFixed(3)).join();
    if (a === b) continue;
    const key = a < b ? a + "|" + b : b + "|" + a;
    if (seen.has(key)) dobbelt++; else seen.add(key);
  }
  return dobbelt / Math.max(1, line.length);
}

function forenkl(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = a, [x2, y2] = b, dx = x2 - x1, dy = y2 - y1;
    const t = dx || dy ? Math.max(0, Math.min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy))) : 0;
    const d = Math.hypot(x0 - x1 - t * dx, y0 - y1 - t * dy);
    if (d > max) { max = d; idx = i; }
  }
  return max > eps ? forenkl(pts.slice(0, idx + 1), eps).slice(0, -1).concat(forenkl(pts.slice(idx), eps)) : [a, b];
}

const vent = (ms) => new Promise((r) => setTimeout(r, ms));

async function lavRute({ start, km, retning, stil = "", underlag = "", undgaa = {}, maksForslag = 0 }, onProgress) {
  const grus = underlag === "grus";
  const mange = stil || grus;
  const pause = grus ? 1100 : 400; // Valhalla er en gratis tjeneste – højst ca. ét kald i sekundet
  const antal = maksForslag || (mange ? 5 : 3);
  const varianter = retning === ""
    ? Array.from({ length: antal }, (_, i) => (Math.random() * 72 + i * 72) % 360)
    : (mange ? [-35, -15, 0, 15, 35] : [-25, 0, 25]).slice(0, maksForslag || undefined).map((d) => (RETNING_GRADER[retning] + d + 360) % 360);
  // Grus: 3 punkter + en grusvej mellem hvert par = 7 mellempunkter (Valhalla tillader højst 10 i alt)
  const n = grus ? 3 : km < 60 ? 3 : km < 150 ? 4 : 5;
  const veje = grus ? await hentGrus().catch(() => null) : null;
  let radius = km / (2 * Math.PI * 1.3);
  const kandidater = [];
  for (let v = 0; v < varianter.length; v++) {
    const grader = varianter[v];
    let res = null;
    for (let forsoeg = 0; forsoeg < (mange ? 2 : 3); forsoeg++) {
      onProgress && onProgress(`Beregner forslag ${v + 1} af ${varianter.length}…`);
      let mellem = cirkelPunkter(start, radius, grader, n);
      if (veje) mellem = grusPunkter(start, mellem, radius, veje);
      res = await osrmRute([start, ...mellem, start], underlag, undgaa);
      const afv = Math.abs(res.km - km) / km;
      radius *= km / res.km; // lær af resultatet – også til de næste forslag
      if (afv <= 0.1) break;
      await vent(pause); // skån den gratis tjeneste
    }
    if (grus) {
      onProgress && onProgress(`Tjekker vejbelægning på forslag ${v + 1}…`);
      await vent(pause);
      try { await maalUnderlag(res); } catch { Object.assign(res, { grusKm: 0, eKm: 0, smaa: 0, sporKm: 0 }); }
    }
    res.grader = grader;
    res.basis = Math.abs(res.km - km) / km + (res.eKm / res.km) * 2 + gentagelse(res.line) * 3 + ((res.sporKm || 0) / res.km) * 3;
    res.sving = svingPrKm(res.line);
    if (stil === "bakket") {
      onProgress && onProgress(`Måler højder på forslag ${v + 1}…`);
      try { res.stigning = await stigningPrKm(res.line, res.km); } catch { res.stigning = 0; }
    }
    kandidater.push(res);
    if (!mange && res.basis < 0.1) break; // godt nok
    await vent(pause);
  }
  // Vælg: basis (længde, motorvej, frem-og-tilbage) minus bonus for den valgte stil
  const maal = { snoet: (k) => k.sving, bakket: (k) => k.stigning || 0, smaa: (k) => k.smaa }[stil];
  const maks = maal ? Math.max(...kandidater.map(maal), 1e-9) : 1;
  const maksGrus = Math.max(...kandidater.map((k) => (k.grusKm || 0) / k.km), 1e-9);
  kandidater.forEach((k) => (k.score = k.basis - (maal ? 0.6 * (maal(k) / maks) : 0) - (grus ? 0.8 * ((k.grusKm || 0) / k.km / maksGrus) : 0)));
  const bedst = kandidater.reduce((a, b) => (b.score < a.score ? b : a));
  if (bedst.stigning == null) { try { bedst.stigning = await stigningPrKm(bedst.line, bedst.km); } catch { /* vises bare ikke */ } }
  return bedst;
}

function retningsNavn(grader) {
  const navne = ["nord", "nordøst", "øst", "sydøst", "syd", "sydvest", "vest", "nordvest"];
  return navne[Math.round(grader / 45) % 8];
}

/* ---------- Visning ---------- */
function renderPlanner() {
  destroyMap();
  setHeader("Lav min egen rute", true);
  const p = Object.assign({ by: "Hobro", km: 100, retning: "", stil: "", underlag: "", omraade: "", undgaa: {} }, lsGet(PLAN_KEY, {}));
  if (!(p.underlag in UNDERLAG)) p.underlag = "";
  const byer = ["Aars", "Hobro", "Randers"];
  view.innerHTML = `
    <div class="filter-label">Start fra</div>
    <div class="chips" id="byChips">
      ${byer.map((b) => `<button class="chip ${p.by === b ? "on" : ""}" data-by="${b}">${b}</button>`).join("")}
      <button class="chip ${p.by === "pos" ? "on" : ""}" data-by="pos">📍 Min position</button>
    </div>
    <div class="pad" style="padding-top:0">
      <label class="field">Anden by
        <select id="andenBy"><option value="">– Vælg –</option>${Object.keys(BYER).filter((b) => !byer.includes(b)).map((b) => `<option ${p.by === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
      </label>
    </div>
    <div class="filter-label">Længde</div>
    <div class="pad" style="padding-top:4px">
      <div class="km-value"><span id="kmVal">${p.km}</span> km</div>
      <input type="range" id="km" min="30" max="300" step="10" value="${p.km}" class="slider">
      <div class="row muted" style="justify-content:space-between;font-size:12px"><span>30</span><span>300</span></div>
    </div>
    <div class="filter-label">Retning</div>
    <div class="chips" id="retChips">
      ${Object.entries(RETNINGER).map(([k, v]) => `<button class="chip ${p.retning === k ? "on" : ""}" data-ret="${k}">${v}</button>`).join("")}
    </div>
    <div class="filter-label">Type rute</div>
    <div class="chips" id="stilChips">
      ${Object.entries(STILE).map(([k, v]) => `<button class="chip ${p.stil === k ? "on" : ""}" data-stil="${k}">${v.ikon ? v.ikon + " " : ""}${v.navn}</button>`).join("")}
    </div>
    <div class="pad muted" id="stilTekst" style="padding-top:0;font-size:14px">${STILE[p.stil].tekst}</div>
    <div class="filter-label">Vejbelægning</div>
    <div class="chips" id="underlagChips">
      ${Object.entries(UNDERLAG).map(([k, v]) => `<button class="chip ${p.underlag === k ? "on" : ""}" data-underlag="${k}">${v.navn}</button>`).join("")}
    </div>
    <div class="pad muted" id="underlagTekst" style="padding-top:0;font-size:14px">${UNDERLAG[p.underlag].tekst}</div>
    <div class="filter-label">Undgå</div>
    <div class="chips" id="undgaaChips">
      ${Object.entries(UNDGAA).map(([k, v]) => `<button class="chip ${p.undgaa[k] ? "on" : ""}" data-undgaa="${k}" aria-pressed="${!!p.undgaa[k]}">${v.navn}</button>`).join("")}
    </div>
    <div class="pad muted" style="padding-top:0;font-size:14px">Tryk for at slå til og fra. Valgte vejtyper bliver ikke brugt.</div>
    <div id="omraadeBoks" ${p.underlag === "grus" ? "" : "hidden"}>
      <div class="filter-label">Hvor må grusturen ligge?</div>
      <div class="chips" id="omraadeChips">
        <button class="chip ${p.omraade !== "midtnord" ? "on" : ""}" data-omraade="">Fra startstedet</button>
        <button class="chip ${p.omraade === "midtnord" ? "on" : ""}" data-omraade="midtnord">Hele Midt- og Nordjylland</button>
      </div>
      <div class="pad muted" style="padding-top:0;font-size:14px">"Hele Midt- og Nordjylland" prøver flere egne (fx Thy, Han Herred, Vendsyssel og Djursland) og vælger den tur med mest grus. Tager ca. et halvt minut.</div>
    </div>
    <div class="btn-row"><button class="btn block" id="lavBtn">Lav rute</button></div>
    <div id="planStatus" class="pad muted"></div>
    <p class="muted pad">Ruten beregnes på OpenStreetMap-veje og foretrækker veje uden motorvej – vælg "Undgå" ovenfor for at udelukke motorvej, betalingsveje eller færger helt. Grusveje vælges kun, hvor motorcykler har adgang ifølge kortdata – skilte som "Privat vej" eller "Kun landbrugskørsel" gælder altid. Kræver internet. Tryk igen for et nyt forslag.</p>
  `;
  const gem = () => lsSet(PLAN_KEY, p);
  $("#byChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.by = b.dataset.by; $("#andenBy").value = ""; gem();
    view.querySelectorAll("#byChips .chip").forEach((c) => c.classList.toggle("on", c === b));
  };
  $("#andenBy").onchange = (e) => {
    if (!e.target.value) return;
    p.by = e.target.value; gem();
    view.querySelectorAll("#byChips .chip").forEach((c) => c.classList.remove("on"));
  };
  $("#km").oninput = (e) => { p.km = Number(e.target.value); $("#kmVal").textContent = p.km; };
  $("#km").onchange = gem;
  $("#retChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.retning = b.dataset.ret; gem();
    view.querySelectorAll("#retChips .chip").forEach((c) => c.classList.toggle("on", c === b));
  };
  $("#stilChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.stil = b.dataset.stil; gem();
    view.querySelectorAll("#stilChips .chip").forEach((c) => c.classList.toggle("on", c === b));
    $("#stilTekst").textContent = STILE[p.stil].tekst + (p.stil ? " Tager lidt længere tid, fordi der laves flere forslag." : "");
  };
  $("#underlagChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.underlag = b.dataset.underlag; gem();
    view.querySelectorAll("#underlagChips .chip").forEach((c) => c.classList.toggle("on", c === b));
    $("#underlagTekst").textContent = UNDERLAG[p.underlag].tekst + (p.underlag === "grus" ? " Tager lidt længere tid." : "");
    $("#omraadeBoks").hidden = p.underlag !== "grus";
  };
  $("#undgaaChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    const k = b.dataset.undgaa;
    p.undgaa = Object.assign({}, p.undgaa, { [k]: !p.undgaa[k] }); gem();
    b.classList.toggle("on", p.undgaa[k]); b.setAttribute("aria-pressed", p.undgaa[k]);
  };
  $("#omraadeChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.omraade = b.dataset.omraade; gem();
    view.querySelectorAll("#omraadeChips .chip").forEach((c) => c.classList.toggle("on", c === b));
  };
  $("#lavBtn").onclick = () => startPlan(p);
}

async function hentStart(by) {
  if (by !== "pos") return { navn: by, punkt: BYER[by] };
  const pos = await new Promise((ok, fejl) => {
    if (!navigator.geolocation) return fejl(new Error("Ingen GPS"));
    navigator.geolocation.getCurrentPosition(ok, fejl, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
  return { navn: "min position", punkt: [pos.coords.latitude, pos.coords.longitude] };
}

async function startPlan(p) {
  const status = $("#planStatus"), btn = $("#lavBtn");
  if (!navigator.onLine) { status.textContent = "Du er offline – ruten kan kun laves med internet."; return; }
  btn.disabled = true; btn.textContent = "Arbejder…";
  try {
    status.textContent = p.by === "pos" && !(p.underlag === "grus" && p.omraade === "midtnord") ? "Finder din position…" : "";
    const vidt = p.underlag === "grus" && p.omraade === "midtnord";
    let s, r;
    if (vidt) {
      // Prøv 4 tilfældige egne med 2 forslag hver – behold turen med størst andel grus
      const steder = Object.entries(GRUS_OMRAADER).sort(() => Math.random() - 0.5).slice(0, 4);
      for (let i = 0; i < steder.length; i++) {
        const [navn, punkt] = steder[i];
        try {
          const k = await lavRute({ start: punkt, km: p.km, retning: "", stil: p.stil, underlag: "grus", undgaa: p.undgaa, maksForslag: 2 },
            (t) => (status.textContent = `Egn ${i + 1} af ${steder.length} (${navn}): ${t}`));
          k.vaerdi = (k.grusKm || 0) / k.km - Math.abs(k.km - p.km) / p.km;
          if (!r || k.vaerdi > r.vaerdi) { r = k; s = { navn, punkt }; }
        } catch (e) { console.warn("Egn fejlede", navn, e); }
      }
      if (!r) throw new Error("Ingen rute");
    } else {
      s = await hentStart(p.by);
      r = await lavRute({ start: s.punkt, km: p.km, retning: p.retning, stil: p.stil, underlag: p.underlag, undgaa: p.undgaa }, (t) => (status.textContent = t));
    }
    const grusKm = r.grusKm != null ? Math.round(r.grusKm) : null;
    const km = Math.round(r.km);
    const retning = p.retning ? RETNINGER[p.retning].toLowerCase() : retningsNavn(r.grader);
    sidstePlan = {
      id: "egen-" + uid(),
      egen: true,
      navn: `${p.stil ? STILE[p.stil].navn + " rundtur" : p.underlag === "grus" ? "Grus-rundtur" : "Rundtur"} fra ${s.navn === "min position" ? "min position" : s.navn}, ${km} km mod ${retning}`,
      region: "", vejtype: [], start: s.navn === "min position" ? "Min position" : s.navn, slut: "Samme sted (rundtur)",
      beskrivelse: `Automatisk lavet ${p.stil ? STILE[p.stil].navn.toLowerCase() + " " : ""}rundtur på ca. ${km} km mod ${retning}${r.eKm > 1 ? `. Ca. ${Math.round(r.eKm)} km på E-vej/motorvej.` : "."}${p.underlag === "asfalt" ? " Kun asfalt." : ""}${valgteUndgaa(p.undgaa).length ? " Uden " + valgteUndgaa(p.undgaa).map((k) => UNDGAA[k].navn.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " og $1") + "." : ""}${vidt ? ` Startstedet ${s.navn} er valgt, fordi turen herfra havde mest grus af de egne i Midt- og Nordjylland, der blev prøvet.` : ""}${p.underlag === "grus" ? ` Ca. ${grusKm} km grusvej. Grusveje er valgt efter OpenStreetMap, hvor motorcykler har adgang – respektér altid skilte om privat vej eller landbrugskørsel.` : ""} Tjek ruten på kortet før du kører – den er beregnet automatisk og kender ikke vejarbejde eller lukkede veje.`,
      stop: [], kilder: [],
      km, min: Math.round(r.min), line: forenkl(r.line, 0.00008), oprettet: today(),
      stil: p.stil, stats: { sving: Math.round(r.sving), stigning: r.stigning != null ? Math.round(r.stigning * 10) / 10 : null, smaa: Math.round(r.smaa * 100), grus: grusKm }
    };
    // Ærlig besked hvis området ikke har meget af det ønskede
    const svag = { bakket: r.stigning != null && r.stigning < 5, snoet: r.sving < 40, smaa: r.smaa < 0.4 }[p.stil];
    if (p.underlag === "grus" && grusKm < Math.max(3, km * 0.05)) sidstePlan.beskrivelse += vidt ? " Bemærk: grusveje med adgang er sjældne i kortdata – tryk \"Lav en ny\" for at prøve andre egne." : " Bemærk: der er ikke mange grusveje med adgang i området – prøv evt. en anden retning, startby eller \"Hele Midt- og Nordjylland\".";
    if (svag) sidstePlan.beskrivelse += ` Bemærk: området har ikke meget ${{ bakket: "op og ned", snoet: "snoet vej", smaa: "små veje" }[p.stil]} – dette var det bedste af flere forslag. Prøv evt. en anden retning eller startby.`;
    location.hash = "#rute/" + sidstePlan.id;
  } catch (e) {
    status.textContent = e && e.code === 1 ? "Placering blev ikke tilladt – vælg en by i stedet." : "Kunne ikke lave ruten lige nu. Prøv igen om lidt.";
  } finally {
    btn.disabled = false; btn.textContent = "Lav rute";
  }
}

function gemEgenRute(r) {
  if (!Array.isArray(DB.mineRuter)) DB.mineRuter = [];
  if (!DB.mineRuter.some((x) => x.id === r.id)) DB.mineRuter.unshift(r);
  save();
}

function sletEgenRute(id) {
  DB.mineRuter = (DB.mineRuter || []).filter((x) => x.id !== id);
  save();
}
