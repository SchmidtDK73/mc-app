"use strict";
/* ===================== Find undervejs =====================
   Spisesteder, caféer, tankstationer, butikker og toiletter langs en rute (OpenStreetMap).
   Faste ruter: forudhentet i data/steder.json (virker offline).
   Egne ruter: hentes live fra Overpass (flere servere), gemmes på ruten når den er gemt.
   Et sted kan lægges ind som stop – ruten lægges så om forbi stedet. */

const KATEGORIER = {
  spise: { ikon: "🍽️", navn: "Spise", ental: "Spisested", soeg: "restaurant" },
  cafe: { ikon: "☕", navn: "Café/is", ental: "Café", soeg: "café" },
  tank: { ikon: "⛽", navn: "Tanke", ental: "Tankstation", soeg: "tankstation" },
  handle: { ikon: "🛒", navn: "Handle ind", ental: "Butik", soeg: "supermarked" },
  toilet: { ikon: "🚻", navn: "Toilet", ental: "Toilet", soeg: "offentligt toilet" }
};
const OVERPASS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"];
let STEDER_FAST = null;
const stedCache = {};
let uvLayer = null;

function hav(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function linjeKm(line) { let s = 0; for (let i = 1; i < line.length; i++) s += hav(line[i - 1], line[i]); return s; }

// Nærmeste punkt på ruten: afstand (m), km fra start (skaleret til rutens km) og indeks
function paaRuten(p, line, rKm) {
  const kx = 111.32 * Math.cos((p[0] * Math.PI) / 180), ky = 110.54;
  let best = Infinity, bestI = 1, bestT = 0;
  for (let i = 1; i < line.length; i++) {
    const ax = line[i - 1][1] * kx, ay = line[i - 1][0] * ky, bx = line[i][1] * kx, by = line[i][0] * ky;
    const dx = bx - ax, dy = by - ay, px = p[1] * kx, py = p[0] * ky;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
    if (d < best) { best = d; bestI = i; bestT = t; }
  }
  let km = 0;
  for (let i = 1; i < bestI; i++) km += hav(line[i - 1], line[i]);
  km += hav(line[bestI - 1], line[bestI]) * bestT;
  const total = linjeKm(line) || 1;
  return { m: best * 1000, km: (km * (rKm || total)) / total, i: bestI };
}

async function hentFaste() {
  if (!STEDER_FAST) {
    try { const res = await fetch("data/steder.json"); STEDER_FAST = res.ok ? await res.json() : {}; }
    catch { STEDER_FAST = {}; }
  }
  return STEDER_FAST;
}

async function overpassLive(line) {
  const la = line.map((p) => p[0]), lo = line.map((p) => p[1]), m = 0.015;
  const bb = `${Math.min(...la) - m},${Math.min(...lo) - m},${Math.max(...la) + m},${Math.max(...lo) + m}`;
  const q = `[out:json][timeout:60];(nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|fuel|toilets)$"](${bb});nwr["shop"~"^(supermarket|convenience)$"](${bb}););out center tags;`;
  const AM = { restaurant: "spise", fast_food: "spise", cafe: "cafe", ice_cream: "cafe", fuel: "tank", toilets: "toilet" };
  const SH = { supermarket: "handle", convenience: "handle" };
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctrl.signal });
      if (!res.ok) continue;
      const d = await res.json();
      return d.elements.map((el) => {
        const t = el.tags || {}, kat = AM[t.amenity] || SH[t.shop];
        const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
        return kat && lat != null ? [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, kat, t.name || t.brand || "", t.opening_hours || ""] : null;
      }).filter(Boolean);
    } catch { /* prøv næste server */ } finally { clearTimeout(timer); }
  }
  throw new Error("Ingen svar");
}

// Alle steder for ruten med afstand og km-position
async function stederFor(r) {
  if (stedCache[r.id]) return stedCache[r.id];
  let raa = [];
  const basis = r.egen ? r.basis : r.id;
  const fast = basis ? (await hentFaste())[basis] : null;
  if (fast) raa = raa.concat(fast);
  if (!r.egen && !fast) raa = raa.concat(await overpassLive(r.line)); // ingen forudhentede data → hent live
  if (r.egen) {
    if (r.steder) raa = raa.concat(r.steder);
    else {
      const live = await overpassLive(r.line);
      r.steder = live;
      if ((DB.mineRuter || []).some((x) => x.id === r.id)) save();
      raa = raa.concat(live);
    }
  }
  const set = new Set();
  const liste = raa.filter((s) => { const k = s[0] + "," + s[1] + s[2]; if (set.has(k)) return false; set.add(k); return true; })
    .map(([lat, lon, kat, navn, aab]) => ({ pos: [lat, lon], kat, navn, aab, ...paaRuten([lat, lon], r.line, r.km) }))
    .filter((s) => s.m <= (s.kat === "tank" ? 1500 : 800))
    .sort((a, b) => a.km - b.km);
  stedCache[r.id] = liste;
  return liste;
}

function kortLink(s) {
  const q = encodeURIComponent(s.navn || KATEGORIER[s.kat].ental);
  return `https://maps.apple.com/?q=${q}&ll=${s.pos[0]},${s.pos[1]}`;
}
function soegLink(r, kat) {
  const mid = r.line[Math.floor(r.line.length / 2)];
  return `https://maps.apple.com/?q=${encodeURIComponent(KATEGORIER[kat].soeg)}&sll=${mid[0]},${mid[1]}&z=10`;
}

/* ---------- Visning på rutesiden ---------- */
function initUndervejs(r) {
  const box = $("#undervejs");
  if (!box) return;
  uvLayer = null; // kortet er nyt
  // Vis stop med position som markører
  r.stop.filter((s) => s.pos).forEach((s) => L.marker(s.pos, { icon: L.divIcon({ className: "uv-pin stop", html: "📍", iconSize: [30, 30] }) }).bindTooltip(s.navn).addTo(map));
  box.innerHTML = `
    <div class="section-title">Find undervejs</div>
    <div class="chips" id="uvChips">${Object.entries(KATEGORIER).map(([k, v]) => `<button class="chip" data-kat="${k}">${v.ikon} ${v.navn}</button>`).join("")}</div>
    <div id="uvList"></div>`;
  $("#uvChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    view.querySelectorAll("#uvChips .chip").forEach((c) => c.classList.toggle("on", c === b));
    visKategori(r, b.dataset.kat);
  };
}

async function visKategori(r, kat) {
  const list = $("#uvList");
  const K = KATEGORIER[kat];
  list.innerHTML = `<div class="empty">Søger efter ${K.navn.toLowerCase()} langs ruten…${!stedCache[r.id] && !(STEDER_FAST && STEDER_FAST[r.egen ? r.basis : r.id]) ? "<br>Det kan tage op til et minut." : ""}</div>`;
  let alle;
  try { alle = await stederFor(r); }
  catch {
    list.innerHTML = `<div class="card">Kunne ikke hente steder lige nu (kortdatatjenesten er optaget eller du er offline).
      <div class="btn-row" style="margin:10px 0 0"><a class="btn secondary" target="_blank" rel="noopener" href="${soegLink(r, kat)}">Søg ${K.navn.toLowerCase()} i Kort</a></div></div>`;
    return;
  }
  if (!$("#uvList") || !view.querySelector(`#uvChips .chip.on[data-kat="${kat}"]`)) return; // brugeren har valgt noget andet
  const steder = alle.filter((s) => s.kat === kat);
  if (uvLayer) uvLayer.remove();
  uvLayer = L.layerGroup(steder.map((s) => L.marker(s.pos, { icon: L.divIcon({ className: "uv-pin", html: K.ikon, iconSize: [30, 30] }) }).bindTooltip(s.navn || K.ental))).addTo(map);
  list.innerHTML = steder.length ? steder.slice(0, 40).map((s, i) => `
    <div class="card">
      <div class="row">
        <div class="uv-ikon">${K.ikon}</div>
        <div class="grow">
          <b>${esc(s.navn || K.ental)}</b>
          <div class="muted">efter ca. ${Math.round(s.km)} km · ${s.m < 100 ? "ved ruten" : Math.round(s.m / 50) * 50 + " m fra ruten"}</div>
          ${s.aab ? `<div class="muted" style="font-size:13px">Åbent: ${esc(s.aab)}</div>` : ""}
        </div>
      </div>
      <div class="btn-row" style="margin:10px 0 0">
        <a class="btn secondary" target="_blank" rel="noopener" href="${kortLink(s)}">Vis i Kort</a>
        <button class="btn secondary" data-stop="${i}">Tilføj som stop</button>
      </div>
    </div>`).join("") + `<p class="muted pad">Data fra OpenStreetMap – åbningstider kan være forældede.</p>`
    : `<div class="card">Ingen ${K.navn.toLowerCase()} fundet tæt på ruten.
        <div class="btn-row" style="margin:10px 0 0"><a class="btn secondary" target="_blank" rel="noopener" href="${soegLink(r, kat)}">Søg i Kort</a></div></div>`;
  list.querySelectorAll("[data-stop]").forEach((b) => (b.onclick = () => tilfoejStop(r, steder[Number(b.dataset.stop)], b)));
}

// Læg ruten om forbi stedet: erstat et lille stykke af ruten med en omvej via stedet
async function tilfoejStop(r, s, knap) {
  if (!navigator.onLine) { toast("Kræver internet"); return; }
  knap.disabled = true; knap.textContent = "Lægger rute om…";
  try {
    const line = r.line, n = line.length;
    const a = Math.max(0, s.i - 3), b = Math.min(n - 1, s.i + 2);
    const omvej = await osrmRute([line[a], s.pos, line[b]]);
    const nyLine = line.slice(0, a).concat(omvej.line, line.slice(b + 1));
    const gammelKm = linjeKm(line), nyKm = linjeKm(nyLine);
    const K = KATEGORIER[s.kat];
    const stop = { navn: s.navn || K.ental, tekst: `${K.ental} – tilføjet som stop efter ca. ${Math.round(s.km)} km`, pos: s.pos };
    let maal = r;
    if (!r.egen) {
      maal = { ...r, id: "egen-" + uid(), egen: true, basis: r.id, hjem: undefined, navn: `${r.navn} med stop`, stop: [...r.stop], oprettet: today() };
      sidstePlan = maal;
    }
    maal.line = forenkl(nyLine, 0.00008);
    maal.km = Math.round((r.km * nyKm) / gammelKm);
    maal.min = Math.round((r.min * nyKm) / gammelKm + 3);
    maal.stop = [...maal.stop, stop];
    delete stedCache[maal.id];
    if ((DB.mineRuter || []).some((x) => x.id === maal.id)) save();
    toast(`${stop.navn} er lagt ind som stop`);
    if (maal.id === r.id) renderRute(r.id); else location.hash = "#rute/" + maal.id;
  } catch {
    toast("Kunne ikke lægge ruten om lige nu");
    knap.disabled = false; knap.textContent = "Tilføj som stop";
  }
}
