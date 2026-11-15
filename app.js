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

const filters = Object.assign({ region: "", laengde: "", vejtype: "" }, lsGet("mcapp.filters", {}));

function laengdeKlasse(km) { return km < 50 ? "kort" : km <= 80 ? "mellem" : "lang"; }
function filtered() {
  return ROUTES.filter((r) =>
    (!filters.region || r.region === filters.region) &&
    (!filters.laengde || laengdeKlasse(r.km) === filters.laengde) &&
    (!filters.vejtype || r.vejtype.includes(filters.vejtype))
  );
}
function fmtTid(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} t ${m} min` : `${m} min`; }

let map = null;
function destroyMap() { if (map) { map.remove(); map = null; } }

function makeMap(el) {
  const m = L.map(el, { zoomControl: false, attributionControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(m);
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
  view.innerHTML = `
    <div id="map" class="map"></div>
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
            ${r.vejtype.map((v) => `<span class="tag">${VEJTYPER[v]}</span>`).join("")}
          </div>
          <span class="muted" style="font-size:22px">›</span>
        </div>
      </button>`).join("") : `<div class="empty">Ingen ruter matcher filtrene.</div>`}
    <p class="muted pad">Ruteforløb er beregnet på OpenStreetMap-veje. Tjek altid skiltning og lokale forhold – veje kan være lukkede eller ændrede.</p>
  `;

  view.querySelectorAll(".chips").forEach((row) => row.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    filters[row.dataset.filter] = b.dataset.val;
    lsSet("mcapp.filters", filters);
    const y = view.scrollTop;
    renderRuter().then(() => { view.scrollTop = y; });
  }));
  view.querySelectorAll("[data-route]").forEach((b) => b.addEventListener("click", () => { location.hash = "#rute/" + b.dataset.route; }));

  destroyMap();
  map = makeMap($("#map"));
  const shown = list.length ? list : ROUTES;
  const group = L.featureGroup();
  shown.forEach((r) => {
    const pl = L.polyline(r.line, { color: COLORS[ROUTES.indexOf(r) % COLORS.length], weight: 5, opacity: 0.9 });
    pl.bindTooltip(r.navn);
    pl.on("click", () => { location.hash = "#rute/" + r.id; });
    group.addLayer(pl);
  });
  group.addTo(map);
  map.fitBounds(group.getBounds(), { padding: [20, 20] });
}

async function renderRute(id) {
  await loadGeometry();
  const r = ROUTES.find((x) => x.id === id);
  if (!r) { location.hash = "#ruter"; return; }
  setHeader(r.navn, true);
  view.innerHTML = `
    <div id="map" class="map small"></div>
    <div class="card">
      <div class="kv">
        <div>Længde</div><div>${r.km} km</div>
        <div>Køretid (uden stop)</div><div>ca. ${fmtTid(r.min)}</div>
        <div>Start</div><div>${esc(r.start)}</div>
        <div>Slut</div><div>${esc(r.slut)}</div>
        <div>Region</div><div>${esc(r.region)}</div>
      </div>
      <div style="margin-top:6px">${r.vejtype.map((v) => `<span class="tag">${VEJTYPER[v]}</span>`).join("")}</div>
    </div>
    <div class="btn-row">
      <button class="btn" id="gpxBtn">Hent GPX</button>
      <a class="btn secondary" target="_blank" rel="noopener" href="${mapsLink(r)}">Åbn i Kort</a>
    </div>
    <div class="section-title">Om ruten</div>
    <div class="card"><p style="margin:0">${esc(r.beskrivelse)}</p></div>
    <div class="section-title">Gode stop</div>
    <div class="card"><ul class="stops">${r.stop.map((s) => `<li><b>${esc(s.navn)}</b><span class="muted">${esc(s.tekst)}</span></li>`).join("")}</ul></div>
    <div class="section-title">Kilder</div>
    <div class="card sources"><ul class="stops">${r.kilder.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a></li>`).join("")}</ul></div>
  `;
  $("#gpxBtn").addEventListener("click", () => downloadGpx(r));

  destroyMap();
  map = makeMap($("#map"));
  const pl = L.polyline(r.line, { color: "#e8590c", weight: 5 }).addTo(map);
  L.circleMarker(r.line[0], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f9e44", fillOpacity: 1 }).bindTooltip("Start: " + r.start).addTo(map);
  L.circleMarker(r.line[r.line.length - 1], { radius: 8, color: "#fff", weight: 3, fillColor: "#c92a2a", fillOpacity: 1 }).bindTooltip("Slut: " + r.slut).addTo(map);
  map.fitBounds(pl.getBounds(), { padding: [20, 20] });
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
  <wpt lat="${last[0]}" lon="${last[1]}"><name>Slut: ${xe(r.slut)}</name></wpt>
  <trk>
    <name>${xe(r.navn)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

async function downloadGpx(r) {
  const name = r.id + ".gpx";
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

/* ===================== Min MC ===================== */
const SERVICE_TYPER = {
  olie: { navn: "Olieskift", km: 6000, mdr: 12 },
  kaede: { navn: "Kæde (rens/smør/stram)", km: 800, mdr: 0 },
  daek: { navn: "Dækskift", km: 10000, mdr: 60 },
  ventil: { navn: "Ventiljustering", km: 24000, mdr: 0 },
  forsikring: { navn: "Forsikring", km: 0, mdr: 12 },
  andet: { navn: "Andet", km: 0, mdr: 0 }
};
const KEY = "mcapp.v1";

function defaultData() {
  return {
    bike: { navn: "", km: 0, kmDato: today() },
    daek: { forSize: "", bagSize: "", forTryk: "", bagTryk: "", forTrykPas: "", bagTrykPas: "" },
    momenter: [],
    log: [],
    intervaller: {}
  };
}
let DB = Object.assign(defaultData(), lsGet(KEY, {}));
function save() { lsSet(KEY, DB); updateBadge(); }

function interval(type) {
  const d = SERVICE_TYPER[type];
  const o = DB.intervaller[type] || {};
  return { km: o.km ?? d.km, mdr: o.mdr ?? d.mdr };
}
function addMonths(iso, m) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }

function reminder(type) {
  const iv = interval(type);
  if (!iv.km && !iv.mdr) return null;
  const last = DB.log.filter((e) => e.type === type).sort((a, b) => (b.dato + String(b.km).padStart(9, "0")).localeCompare(a.dato + String(a.km).padStart(9, "0")))[0];
  if (!last) return { type, iv, status: "none", text: "Ikke registreret endnu" };
  const parts = [];
  let status = "ok";
  const rank = { ok: 0, soon: 1, due: 2 };
  const bump = (s) => { if (rank[s] > rank[status]) status = s; };
  if (iv.km && last.km !== "" && last.km != null) {
    const nextKm = Number(last.km) + iv.km;
    const left = nextKm - DB.bike.km;
    if (left <= 0) { bump("due"); parts.push(`${fmtKm(-left)} over (${fmtKm(nextKm)})`); }
    else { if (left <= Math.max(300, iv.km * 0.1)) bump("soon"); parts.push(`om ${fmtKm(left)}`); }
  }
  if (iv.mdr) {
    const nextDate = addMonths(last.dato, iv.mdr);
    const left = daysBetween(today(), nextDate);
    if (left <= 0) { bump("due"); parts.push(`forfaldt ${fmtDate(nextDate)}`); }
    else { if (left <= 30) bump("soon"); parts.push(`senest ${fmtDate(nextDate)}`); }
  }
  return { type, iv, last, status, text: parts.join(" · ") || "Ingen interval" };
}

function updateBadge() {
  const n = Object.keys(SERVICE_TYPER).map(reminder).filter((r) => r && r.status === "due").length;
  const span = $('.tabbar [data-tab="mc"] span');
  span.textContent = n ? `Min MC (${n})` : "Min MC";
}

function renderMC() {
  destroyMap();
  setHeader(DB.bike.navn || "Min MC");
  const rems = Object.keys(SERVICE_TYPER).map(reminder).filter(Boolean);
  const order = { due: 0, soon: 1, none: 2, ok: 3 };
  rems.sort((a, b) => order[a.status] - order[b.status]);
  const log = [...DB.log].sort((a, b) => b.dato.localeCompare(a.dato) || (b.km || 0) - (a.km || 0));
  const d = DB.daek;

  view.innerHTML = `
    <button class="card" id="kmCard" style="margin-top:12px">
      <div class="row">
        <div class="grow">
          <div class="muted">Kilometertæller</div>
          <div style="font-size:28px;font-weight:700">${fmtKm(DB.bike.km)}</div>
          <div class="muted">Opdateret ${fmtDate(DB.bike.kmDato)}</div>
        </div>
        <span class="btn secondary" style="pointer-events:none">Opdater</span>
      </div>
    </button>

    <div class="section-title">Påmindelser</div>
    ${rems.map((r) => `
      <button class="card" data-add="${r.type}">
        <div class="row">
          <span class="status ${r.status}"></span>
          <div class="grow">
            <b>${esc(SERVICE_TYPER[r.type].navn)}</b>
            <div class="muted due-text ${r.status}">${esc(r.text)}</div>
            <div class="muted" style="font-size:12px">Interval: ${[r.iv.km ? fmtKm(r.iv.km) : "", r.iv.mdr ? r.iv.mdr + " mdr" : ""].filter(Boolean).join(" / ")}</div>
          </div>
          <span class="muted" style="font-size:24px">+</span>
        </div>
      </button>`).join("")}
    <div class="btn-row"><button class="btn secondary" id="intervalBtn">Ret intervaller</button></div>

    <div class="section-title">Dæk</div>
    <button class="card" id="daekCard">
      <div class="kv">
        <div>Forhjul</div><div>${esc(d.forSize) || "–"}</div>
        <div>Baghjul</div><div>${esc(d.bagSize) || "–"}</div>
        <div>Tryk for (solo / m. passager)</div><div>${esc(d.forTryk) || "–"} / ${esc(d.forTrykPas) || "–"} bar</div>
        <div>Tryk bag (solo / m. passager)</div><div>${esc(d.bagTryk) || "–"} / ${esc(d.bagTrykPas) || "–"} bar</div>
      </div>
    </button>

    <div class="section-title">Momenter</div>
    <div class="card">
      ${DB.momenter.length ? `<ul class="stops">${DB.momenter.map((m) => `
        <li class="row" data-moment="${m.id}"><span class="grow">${esc(m.navn)}</span><b>${esc(m.nm)} Nm</b></li>`).join("")}</ul>`
        : `<div class="muted">Fx akselmøtrik, oliedrænprop, bremsekaliber, kædehjul.</div>`}
      <button class="btn secondary block" id="momentBtn" style="margin-top:10px">Tilføj moment</button>
    </div>

    <div class="section-title">Servicelog</div>
    ${log.length ? log.map((e) => `
      <button class="card" data-edit="${e.id}">
        <div class="row">
          <div class="grow">
            <b>${esc(SERVICE_TYPER[e.type]?.navn || e.type)}</b>
            <div class="muted">${fmtDate(e.dato)} · ${fmtKm(e.km)}${e.pris ? " · " + esc(e.pris) + " kr." : ""}</div>
            ${e.note ? `<div class="muted">${esc(e.note)}</div>` : ""}
          </div>
        </div>
      </button>`).join("") : `<div class="empty">Ingen registreringer endnu. Tryk på + for at tilføje.</div>`}

    <div class="section-title">Data</div>
    <div class="card">
      <div class="muted">Alt gemmes kun på denne telefon. Tag en backup en gang imellem.</div>
      <div class="btn-row" style="margin:10px 0 0">
        <button class="btn secondary" id="exportBtn">Backup</button>
        <button class="btn secondary" id="importBtn">Gendan</button>
      </div>
      <button class="btn secondary block" id="bikeBtn" style="margin-top:10px">Navn på MC</button>
      <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    </div>
    <button class="fab" id="fab" aria-label="Ny registrering">+</button>
  `;

  $("#kmCard").onclick = editKm;
  $("#fab").onclick = () => editEntry(null, "olie");
  view.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => editEntry(null, b.dataset.add)));
  view.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => editEntry(DB.log.find((e) => e.id === b.dataset.edit))));
  view.querySelectorAll("[data-moment]").forEach((b) => (b.onclick = () => editMoment(DB.momenter.find((m) => m.id === b.dataset.moment))));
  $("#momentBtn").onclick = () => editMoment(null);
  $("#daekCard").onclick = editDaek;
  $("#intervalBtn").onclick = editIntervals;
  $("#bikeBtn").onclick = editBike;
  $("#exportBtn").onclick = exportData;
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = importData;
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
const numOrEmpty = (v) => (v === "" || v == null ? "" : Number(String(v).replace(",", ".")));

function editKm() {
  openSheet(`
    <h2>Opdater kilometertal</h2>
    <form id="f">
      <label class="field">Km-tæller nu<input name="km" type="number" inputmode="numeric" min="0" value="${DB.bike.km || ""}" required></label>
      <button class="btn block">Gem</button>
    </form>`, (s) => {
    const inp = $("[name=km]", s); inp.focus(); inp.select();
    $("#f", s).onsubmit = (e) => {
      e.preventDefault();
      DB.bike.km = Number(inp.value) || 0;
      DB.bike.kmDato = today();
      save(); closeSheet(); renderMC();
    };
  });
}

function editEntry(entry, defType) {
  const e = entry || { type: defType || "olie", dato: today(), km: DB.bike.km || "", note: "", pris: "" };
  openSheet(`
    <h2>${entry ? "Ret registrering" : "Ny registrering"}</h2>
    <form id="f">
      <label class="field">Type
        <select name="type">${Object.entries(SERVICE_TYPER).map(([k, v]) => `<option value="${k}" ${k === e.type ? "selected" : ""}>${v.navn}</option>`).join("")}</select>
      </label>
      <div class="grid2">
        <label class="field">Dato<input name="dato" type="date" value="${esc(e.dato)}" required></label>
        <label class="field">Km<input name="km" type="number" inputmode="numeric" min="0" value="${esc(e.km)}"></label>
      </div>
      <label class="field">Pris (kr.)<input name="pris" type="number" inputmode="decimal" min="0" step="any" value="${esc(e.pris)}"></label>
      <label class="field">Note<textarea name="note" placeholder="Fx olietype, dækmodel, værksted, policenr.">${esc(e.note)}</textarea></label>
      <button class="btn block">Gem</button>
      ${entry ? `<button type="button" class="btn danger block" id="del">Slet registrering</button>` : ""}
    </form>`, (s) => {
    $("#f", s).onsubmit = (ev) => {
      ev.preventDefault();
      const d = formData(ev.target);
      const rec = { id: entry ? entry.id : uid(), type: d.type, dato: d.dato, km: numOrEmpty(d.km), pris: d.pris, note: d.note.trim() };
      if (entry) Object.assign(entry, rec); else DB.log.push(rec);
      if (rec.km !== "" && rec.km > (DB.bike.km || 0)) { DB.bike.km = rec.km; DB.bike.kmDato = rec.dato > DB.bike.kmDato ? rec.dato : today(); }
      save(); closeSheet(); renderMC(); toast("Gemt");
    };
    const del = $("#del", s);
    if (del) del.onclick = () => {
      if (!confirm("Slet denne registrering?")) return;
      DB.log = DB.log.filter((x) => x.id !== entry.id);
      save(); closeSheet(); renderMC();
    };
  });
}

function editDaek() {
  const d = DB.daek;
  const f = (name, label, ph, mode = "text") => `<label class="field">${label}<input name="${name}" inputmode="${mode}" placeholder="${ph}" value="${esc(d[name])}"></label>`;
  openSheet(`
    <h2>Dæk og dæktryk</h2>
    <form id="f">
      ${f("forSize", "Dækstørrelse for", "120/70 ZR17")}
      ${f("bagSize", "Dækstørrelse bag", "180/55 ZR17")}
      <div class="grid2">
        ${f("forTryk", "Tryk for, solo (bar)", "2,5", "decimal")}
        ${f("bagTryk", "Tryk bag, solo (bar)", "2,9", "decimal")}
        ${f("forTrykPas", "For m. passager (bar)", "2,5", "decimal")}
        ${f("bagTrykPas", "Bag m. passager (bar)", "2,9", "decimal")}
      </div>
      <p class="muted">Brug altid værdierne fra instruktionsbogen eller mærkaten på svingarmen.</p>
      <button class="btn block">Gem</button>
    </form>`, (s) => {
    $("#f", s).onsubmit = (ev) => { ev.preventDefault(); Object.assign(DB.daek, formData(ev.target)); save(); closeSheet(); renderMC(); };
  });
}

function editMoment(m) {
  openSheet(`
    <h2>${m ? "Ret moment" : "Nyt moment"}</h2>
    <form id="f">
      <label class="field">Hvad<input name="navn" placeholder="Fx bagakselmøtrik" value="${esc(m?.navn)}" required></label>
      <label class="field">Moment (Nm)<input name="nm" inputmode="decimal" placeholder="100" value="${esc(m?.nm)}" required></label>
      <button class="btn block">Gem</button>
      ${m ? `<button type="button" class="btn danger block" id="del">Slet</button>` : ""}
    </form>`, (s) => {
    $("#f", s).onsubmit = (ev) => {
      ev.preventDefault();
      const d = formData(ev.target);
      if (m) Object.assign(m, d); else DB.momenter.push({ id: uid(), ...d });
      save(); closeSheet(); renderMC();
    };
    const del = $("#del", s);
    if (del) del.onclick = () => { DB.momenter = DB.momenter.filter((x) => x.id !== m.id); save(); closeSheet(); renderMC(); };
  });
}

function editIntervals() {
  openSheet(`
    <h2>Serviceintervaller</h2>
    <p class="muted">Påmindelse når et af intervallerne er nået. 0 = ikke brugt. Tjek instruktionsbogen for din model.</p>
    <form id="f">
      ${Object.entries(SERVICE_TYPER).filter(([k]) => k !== "andet").map(([k, v]) => {
        const iv = interval(k);
        return `<b>${v.navn}</b>
        <div class="grid2">
          <label class="field">Km<input name="${k}_km" type="number" inputmode="numeric" min="0" value="${iv.km}"></label>
          <label class="field">Måneder<input name="${k}_mdr" type="number" inputmode="numeric" min="0" value="${iv.mdr}"></label>
        </div>`;
      }).join("")}
      <button class="btn block">Gem</button>
      <button type="button" class="btn secondary block" id="reset" style="margin-top:8px">Standardværdier</button>
    </form>`, (s) => {
    $("#f", s).onsubmit = (ev) => {
      ev.preventDefault();
      const d = formData(ev.target);
      Object.keys(SERVICE_TYPER).filter((k) => k !== "andet").forEach((k) => {
        DB.intervaller[k] = { km: Number(d[k + "_km"]) || 0, mdr: Number(d[k + "_mdr"]) || 0 };
      });
      save(); closeSheet(); renderMC();
    };
    $("#reset", s).onclick = () => { DB.intervaller = {}; save(); closeSheet(); renderMC(); };
  });
}

function editBike() {
  openSheet(`
    <h2>Min motorcykel</h2>
    <form id="f">
      <label class="field">Navn / model<input name="navn" placeholder="Fx Honda Africa Twin" value="${esc(DB.bike.navn)}"></label>
      <button class="btn block">Gem</button>
    </form>`, (s) => {
    $("#f", s).onsubmit = (ev) => { ev.preventDefault(); DB.bike.navn = formData(ev.target).navn.trim(); save(); closeSheet(); renderMC(); };
  });
}

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

function importData(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || typeof d !== "object" || !Array.isArray(d.log)) throw new Error("format");
      if (!confirm("Erstat de nuværende data med backuppen?")) return;
      DB = Object.assign(defaultData(), d);
      save(); renderMC(); toast("Backup gendannet");
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
  const tab = h.startsWith("mc") ? "mc" : "ruter";
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  view.scrollTop = 0;
  if (h.startsWith("rute/")) renderRute(h.slice(5));
  else if (tab === "mc") renderMC();
  else renderRuter();
}
window.addEventListener("hashchange", route);

function updateOnline() { $("#offlineBadge").classList.toggle("hidden", navigator.onLine); }
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);

updateOnline();
updateBadge();
route();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
