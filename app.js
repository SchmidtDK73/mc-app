"use strict";

/* ===================== Hjælpere ===================== */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtKm = (n) => (n == null || n === "" || isNaN(n) ? "–" : Number(n).toLocaleString("da-DK") + " km");
const fmtDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }) : "–");
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { toast("Kunne ikke gemme på telefonen"); return false; }
}

/* ===================== Bundark ===================== */
const sheet = $("#sheet"), backdrop = $("#sheetBackdrop");
function openSheet(html, onMount) {
  sheet.innerHTML = html;
  sheet.classList.remove("hidden");
  backdrop.classList.remove("hidden");
  sheet.scrollTop = 0;
  onMount && onMount(sheet);
}
function closeSheet() {
  sheet.classList.add("hidden");
  backdrop.classList.add("hidden");
  sheet.innerHTML = "";
}
backdrop.addEventListener("click", closeSheet);

/* ===================== Ruter ===================== */
const VEJTYPER = { kyst: "Kystvej", bakket: "Bakket/snoet", landevej: "Landevej" };
const LAENGDER = { kort: "Under 50 km", mellem: "50–80 km", lang: "Over 80 km" };
const COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#9c36b5", "#c2255c", "#0c8599", "#f08c00", "#5f3dc4"];
let GEO = null;

async function loadGeometry() {
  if (GEO) return GEO;
  const res = await fetch("data/geometry.json");
  GEO = await res.json();
  ROUTES.forEach((r) => { r.km = GEO[r.id]?.km; r.min = GEO[r.id]?.min; r.line = GEO[r.id]?.line || []; });
  return GEO;
}

const filters = Object.assign({ hjem: "", region: "", laengde: "", vejtype: "" }, lsGet("mcapp.filters", {}));

function laengdeKlasse(km) { return km < 50 ? "kort" : km <= 80 ? "mellem" : "lang"; }
function filtered() {
  return ROUTES.filter((r) =>
    (!filters.hjem || r.hjem === filters.hjem) &&
    (!filters.region || r.region === filters.region) &&
    (!filters.laengde || laengdeKlasse(r.km) === filters.laengde) &&
    (!filters.vejtype || r.vejtype.includes(filters.vejtype))
  );
}
function fmtTid(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} t ${m} min` : `${m} min`; }

let map = null;
function destroyMap() { if (map) { map.remove(); map = null; } }

// Kortbilleder fra Mapbox' gadekort med tydelige bynavne og vejnumre (samme kort i lyst og mørkt tema).
// Uden nøgle: OpenStreetMap. Nøglen er låst til appens adresse, så hele adressen sendes som referer.
function kortLag() {
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  if (!window.MAPBOX_TOKEN) return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: osm });
  return L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${window.MAPBOX_TOKEN}`, {
    maxZoom: 19,
    referrerPolicy: "no-referrer-when-downgrade",
    attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' + osm
  });
}

function makeMap(el) {
  const m = L.map(el, { zoomControl: false, attributionControl: true });
  const lag = kortLag().addTo(m);
  // Afviser Mapbox fliserne (fx nøgle/adresse), skiftes der til OpenStreetMap, så kortet aldrig er tomt.
  if (window.MAPBOX_TOKEN) {
    let ok = 0, fejl = 0;
    lag.on("tileload", () => ok++);
    lag.on("tileerror", () => {
      if (++fejl >= 4 && ok === 0 && m.hasLayer(lag)) {
        m.removeLayer(lag);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(m);
      }
    });
  }
  L.control.zoom({ position: "topright" }).addTo(m);
  return m;
}

function chipRow(name, options, allLabel) {
  const cur = filters[name];
  return `<div class="chips" data-filter="${name}">
    <button class="chip ${!cur ? "on" : ""}" data-val="">${allLabel}</button>
    ${Object.entries(options).map(([v, l]) => `<button class="chip ${cur === v ? "on" : ""}" data-val="${esc(v)}">${esc(l)}</button>`).join("")}
  </div>`;
}

async function renderRuter() {
  setHeader("Ruter");
  await loadGeometry();
  const regions = Object.fromEntries([...new Set(ROUTES.map((r) => r.region))].sort().map((r) => [r, r]));
  const list = filtered();
  const mine = DB.mineRuter || [];
  view.innerHTML = `
    <div id="map" class="map"></div>
    <div class="btn-row"><a class="btn block" href="#ny-rute">＋ Lav min egen rute</a></div>
    ${mine.length ? `<div class="section-title">Mine ruter</div>
    ${mine.map((r) => `
      <a class="card linkcard" href="#rute/${r.id}">
        <div class="row"><div class="grow"><b>${esc(r.navn)}</b><div class="muted">${r.km} km · ca. ${fmtTid(r.min)} · gemt ${fmtDate(r.oprettet)}</div></div>
        <span class="muted" style="font-size:22px">›</span></div>
      </a>`).join("")}` : ""}
    <div class="filter-label">Rundtur fra</div>${chipRow("hjem", { Aars: "Aars", Hobro: "Hobro", Randers: "Randers" }, "Alle")}
    <div class="filter-label">Region</div>${chipRow("region", regions, "Hele landet")}
    <div class="filter-label">Længde</div>${chipRow("laengde", LAENGDER, "Alle")}
    <div class="filter-label">Vejtype</div>${chipRow("vejtype", VEJTYPER, "Alle")}
    <div class="section-title">${list.length} ${list.length === 1 ? "rute" : "ruter"}</div>
    ${list.length ? list.map((r) => `
      <button class="card" data-route="${r.id}">
        <div class="row">
          <span class="status" style="background:${COLORS[ROUTES.indexOf(r) % COLORS.length]}"></span>
          <div class="grow">
            <h3>${esc(r.navn)}</h3>
            <div class="muted">${esc(r.region)} · ${r.km} km · ca. ${fmtTid(r.min)}</div>
            ${r.hjem ? `<span class="tag home">Rundtur fra ${esc(r.hjem)}</span>` : ""}${r.vejtype.map((v) => `<span class="tag">${VEJTYPER[v]}</span>`).join("")}
          </div>
          <span class="muted" style="font-size:22px">›</span>
        </div>
      </button>`).join("") : `<div class="empty">Ingen ruter matcher filtrene.</div>`}
    <p class="muted pad">Ruteforløb er beregnet på OpenStreetMap-veje. Tjek altid skiltning og lokale forhold – veje kan være lukkede eller ændrede.</p>
  `;

  view.querySelectorAll(".chips").forEach((row) => row.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    const navn = row.dataset.filter;
    filters[navn] = b.dataset.val;
    // "Rundtur fra" og "Region" kan modsige hinanden (fx Aars + Midtjylland). Så nulstilles den anden.
    const anden = navn === "hjem" ? "region" : navn === "region" ? "hjem" : "";
    if (anden && filters[anden] && !filtered().length) {
      filters[anden] = "";
      toast(anden === "region" ? "Region nulstillet, så ruterne fra " + filters.hjem + " vises" : "\"Rundtur fra\" nulstillet");
    }
    lsSet("mcapp.filters", filters);
    const y = view.scrollTop;
    renderRuter().then(() => { view.scrollTop = y; });
  }));
  view.querySelectorAll("[data-route]").forEach((b) => b.addEventListener("click", () => { location.hash = "#rute/" + b.dataset.route; }));

  destroyMap();
  map = makeMap($("#map"));
  // Kortet viser kun de ruter, der matcher filtrene (ingen match = tomt Danmarkskort)
  const group = L.featureGroup();
  list.forEach((r) => {
    const pl = L.polyline(r.line, { color: COLORS[ROUTES.indexOf(r) % COLORS.length], weight: 5, opacity: 0.9 });
    pl.bindTooltip(r.navn);
    pl.on("click", () => { location.hash = "#rute/" + r.id; });
    group.addLayer(pl);
  });
  group.addTo(map);
  if (list.length) map.fitBounds(group.getBounds(), { padding: [20, 20] });
  else map.fitBounds([[54.55, 8.07], [57.75, 12.69]]);
}

async function renderRute(id) {
  await loadGeometry();
  const r = findRoute(id);
  if (!r) { location.hash = "#ruter"; return; }
  setHeader(r.egen ? "Min rute" : r.navn, true);
  const gemt = r.egen && (DB.mineRuter || []).some((x) => x.id === r.id);
  view.innerHTML = `
    <div id="map" class="map small"></div>
    ${r.egen ? `<div class="pad" style="padding-bottom:4px"><b>${esc(r.navn)}</b></div>` : ""}
    <div class="card">
      <div class="kv">
        <div>Længde</div><div>${r.km} km</div>
        <div>Køretid (uden stop)</div><div>ca. ${fmtTid(r.min)}</div>
        <div>Start</div><div>${esc(r.start)}</div>
        <div>Slut</div><div>${esc(r.slut)}</div>
        ${r.region ? `<div>Region</div><div>${esc(r.region)}</div>` : ""}
        ${r.stats ? `
          <div>Sving</div><div>${r.stats.sving} °/km ${niveau(r.stats.sving, 40, 80)}</div>
          ${r.stats.stigning != null ? `<div>Stigning</div><div>${String(r.stats.stigning).replace(".", ",")} m/km ${niveau(r.stats.stigning, 5, 9)}</div>` : ""}
          <div>Små veje</div><div>${r.stats.smaa} % ${niveau(r.stats.smaa, 40, 65)}</div>
          ${r.stats.grus != null ? `<div>Grusvej</div><div>ca. ${r.stats.grus} km</div>` : ""}` : ""}
      </div>
      <div style="margin-top:6px">${r.vejtype.map((v) => `<span class="tag">${VEJTYPER[v]}</span>`).join("")}</div>
    </div>
    <div class="btn-row">
      <button class="btn" id="gpxBtn">Send til Beeline</button>
      <a class="btn secondary" target="_blank" rel="noopener" href="${mapsLink(r)}">Åbn i Kort</a>
    </div>
    ${r.egen ? `<div class="btn-row">
      ${gemt ? `<button class="btn danger" id="delRouteBtn">Slet rute</button>` : `<button class="btn" id="saveRouteBtn">Gem rute</button>`}
      <a class="btn secondary" href="#ny-rute">Lav en ny</a>
    </div>` : ""}
    <div class="btn-row"><button class="btn secondary" id="gpxEksportBtn">⬇︎ Eksportér GPX-fil</button></div>
    <div class="center-link"><a href="#" id="beelineHelp">Sådan får du ruten over i Beeline · GPX</a></div>
    <div class="btn-row"><button class="btn secondary" id="logTripBtn">Log som tur i dagbogen</button></div>
    <div id="undervejs"></div>
    <div class="section-title">Om ruten</div>
    <div class="card"><p style="margin:0">${esc(r.beskrivelse)}</p></div>
    ${r.stop.length ? `<div class="section-title">Gode stop</div>
    <div class="card"><ul class="stops">${r.stop.map((s) => `<li><b>${esc(s.navn)}</b><span class="muted">${esc(s.tekst)}</span></li>`).join("")}</ul></div>` : ""}
    ${r.kilder.length ? `<div class="section-title">Kilder</div>
    <div class="card sources"><ul class="stops">${r.kilder.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a></li>`).join("")}</ul></div>` : ""}
  `;
  if ($("#saveRouteBtn")) $("#saveRouteBtn").onclick = () => { gemEgenRute(r); toast("Ruten er gemt under Mine ruter"); renderRute(id); };
  if ($("#delRouteBtn")) $("#delRouteBtn").onclick = () => { if (confirm("Slet denne rute?")) { sletEgenRute(r.id); location.hash = "#ruter"; } };
  $("#gpxBtn").addEventListener("click", () => downloadGpx(r));
  // Samme fil – på iPhone åbner delingsarket, hvor "Gem i Filer" eller en anden GPS-app kan vælges
  $("#gpxEksportBtn").addEventListener("click", () => downloadGpx(r));
  $("#beelineHelp").addEventListener("click", (e) => { e.preventDefault(); beelineHjaelp(r); });
  $("#logTripBtn").addEventListener("click", () => editTrip(null, r.id));

  destroyMap();
  map = makeMap($("#map"));
  const pl = L.polyline(r.line, { color: "#e8590c", weight: 5 }).addTo(map);
  L.circleMarker(r.line[0], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f9e44", fillOpacity: 1 }).bindTooltip("Start: " + r.start).addTo(map);
  L.circleMarker(r.line[r.line.length - 1], { radius: 8, color: "#fff", weight: 3, fillColor: "#c92a2a", fillOpacity: 1 }).bindTooltip("Slut: " + r.slut).addTo(map);
  map.fitBounds(pl.getBounds(), { padding: [20, 20] });
  initUndervejs(r);
}

// Lille vurdering ved rutens tal: lav / middel / høj (grænser sat ud fra danske landeveje)
function niveau(v, middel, hoej) {
  const [t, c] = v >= hoej ? ["høj", "ok"] : v >= middel ? ["middel", "soon"] : ["lav", "none"];
  return `<span class="niveau ${c}">${t}</span>`;
}

function mapsLink(r) {
  // Apple Kort med start → slut via et punkt midt på ruten
  const a = r.line[0], mid = r.line[Math.floor(r.line.length / 2)], b = r.line[r.line.length - 1];
  const end = (a[0] === b[0] && a[1] === b[1]) || Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01 ? mid : b;
  return `https://maps.apple.com/?saddr=${a[0]},${a[1]}&daddr=${end[0]},${end[1]}&dirflg=d`;
}

function gpxString(r) {
  const xe = (s) => esc(s);
  const pts = r.line.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"/>`).join("\n");
  const first = r.line[0], last = r.line[r.line.length - 1];
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MC-app" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xe(r.navn)}</name>
    <desc>${xe(r.beskrivelse)}</desc>
    <copyright author="OpenStreetMap-bidragydere"><license>https://opendatacommons.org/licenses/odbl/</license></copyright>
  </metadata>
  <wpt lat="${first[0]}" lon="${first[1]}"><name>Start: ${xe(r.start)}</name></wpt>
${r.stop.filter((s) => s.pos).map((s) => `  <wpt lat="${s.pos[0]}" lon="${s.pos[1]}"><name>${xe(s.navn)}</name><desc>${xe(s.tekst)}</desc></wpt>\n`).join("")}  <wpt lat="${last[0]}" lon="${last[1]}"><name>Slut: ${xe(r.slut)}</name></wpt>
  <trk>
    <name>${xe(r.navn)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

function gpxFilnavn(r) {
  const ren = r.navn.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (ren || r.id).slice(0, 60) + ".gpx";
}

function beelineHjaelp(r) {
  openSheet(`
    <h2>Send ruten til Beeline</h2>
    <ol class="steps">
      <li>Tryk <b>Send til Beeline</b>. iPhonens delingsark åbner.</li>
      <li>Vælg <b>Beeline</b> i rækken af apps (tryk <i>Flere</i>, hvis den ikke står der).</li>
      <li>Vælg importmåden <b>Turn-by-turn</b> og ruttype <b>motorcykel</b>.</li>
    </ol>
    <p class="muted">Står Beeline ikke i delingsarket: vælg <b>Gem i Filer</b>. Åbn så Beeline › <b>Plan ride</b> › tandhjulet/Options › <b>Import GPX route</b>, og vælg filen under Gennemse › På min iPhone.</p>
    <p class="muted">Beeline tilpasser ruten til sit eget kort ("map-matching"), så der kan være små forskelle. Stop du har tilføjet, kommer med som punkter.</p>
    <button class="btn block" id="sendNu">Send til Beeline nu</button>
    <button class="btn secondary block" id="lukHjaelp" style="margin-top:8px">Luk</button>`, (s) => {
    $("#sendNu", s).onclick = () => { closeSheet(); downloadGpx(r); };
    $("#lukHjaelp", s).onclick = closeSheet;
  });
}

async function downloadGpx(r) {
  const name = gpxFilnavn(r);
  const blob = new Blob([gpxString(r)], { type: "application/gpx+xml" });
  // På iPhone giver delingsarket mulighed for at gemme i Filer eller åbne i en GPS-app
  try {
    const file = new File([blob], name, { type: "application/gpx+xml" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: r.navn });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ===================== Data =====================
   Ture, pakkelister og egne ruter gemmes lokalt på telefonen.
   (Ældre data fra den fjernede "Min MC"-fane bliver liggende urørt.) */
const KEY = "mcapp.v1";

function defaultData() {
  return {
    ture: [],
    mineRuter: [],
    pakkelister: null // oprettes med standardlister første gang (se ture.js)
  };
}
let DB = Object.assign(defaultData(), lsGet(KEY, {}));
function save() { lsSet(KEY, DB); }

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
const numOrEmpty = (v) => (v === "" || v == null ? "" : Number(String(v).replace(",", ".")));

async function exportData() {
  const name = `mc-app-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  try {
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "MC-app backup" }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importData(ev, efter) {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || typeof d !== "object" || !(Array.isArray(d.ture) || Array.isArray(d.mineRuter) || Array.isArray(d.log))) throw new Error("format");
      if (!confirm("Erstat de nuværende data med backuppen?")) return;
      DB = Object.assign(defaultData(), d);
      save(); toast("Backup gendannet"); efter && efter();
    } catch { toast("Filen kunne ikke læses som backup"); }
  };
  reader.readAsText(file);
  ev.target.value = "";
}

/* ===================== Navigation ===================== */
const view = $("#view");
const backBtn = $("#backBtn");
backBtn.onclick = () => (history.length > 1 ? history.back() : (location.hash = "#ruter"));

function setHeader(title, back = false) {
  $("#title").textContent = title;
  backBtn.classList.toggle("hidden", !back);
}

document.querySelectorAll(".tabbar button").forEach((b) => (b.onclick = () => { location.hash = "#" + b.dataset.tab; }));

function route() {
  closeSheet();
  const h = location.hash.slice(1) || "ruter";
  if (h === "mc" || h.startsWith("mc/")) { location.replace("#ruter"); return; }
  const tab = ["vejr", "ture"].find((t) => h === t || h.startsWith(t + "/")) || "ruter";
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  view.scrollTop = 0;
  if (h === "ny-rute") renderPlanner();
  else if (h.startsWith("rute/")) renderRute(h.slice(5));
  else if (tab === "vejr") { destroyMap(); renderVejr(); }
  else if (tab === "ture") { destroyMap(); renderTure(h.split("/").slice(1)); }
  else renderRuter();
}
window.addEventListener("hashchange", route);

function updateOnline() { $("#offlineBadge").classList.toggle("hidden", navigator.onLine); }
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);

// Start når alle scripts (vejr.js, ture.js) er indlæst
window.addEventListener("DOMContentLoaded", () => {
  updateOnline();
  // Fjern et evt. tal på app-ikonet fra den tidligere servicepåmindelse
  if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
  route();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
