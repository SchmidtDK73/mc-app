"use strict";
/* ===================== Find undervejs =====================
   Spisesteder, caféer, tankstationer, butikker og toiletter langs en rute.
   Data fra Geoapify Places API (bygget på OpenStreetMap). Nøglen ligger i config.js og er
   låst til appens adresse hos Geoapify. Resultater gemmes lokalt, så de også kan ses offline.
   Et sted kan lægges ind som stop – ruten lægges så om forbi stedet. */

const KATEGORIER = {
  spise: { ikon: "🍽️", navn: "Spise", ental: "Spisested", soeg: "restaurant", geo: "catering.restaurant,catering.fast_food", maxM: 800 },
  cafe: { ikon: "☕", navn: "Café/is", ental: "Café", soeg: "café", geo: "catering.cafe,catering.ice_cream", maxM: 800 },
  tank: { ikon: "⛽", navn: "Tanke", ental: "Tankstation", soeg: "tankstation", geo: "service.vehicle.fuel", maxM: 1500 },
  handle: { ikon: "🛒", navn: "Handle ind", ental: "Butik", soeg: "supermarked", geo: "commercial.supermarket,commercial.convenience", maxM: 800 },
  toilet: { ikon: "🚻", navn: "Toilet", ental: "Toilet", soeg: "offentligt toilet", geo: "amenity.toilet", maxM: 800 }
};
const STED_KEY = "mcapp.steder";
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

// Del ruten i stykker á ca. 30 km, så hvert opslag dækker et lille område (max 200 steder pr. opslag)
function ruteStykker(line, margin) {
  const stykker = [];
  let cur = [line[0]], km = 0;
  for (let i = 1; i < line.length; i++) {
    cur.push(line[i]); km += hav(line[i - 1], line[i]);
    if (km >= 30 || i === line.length - 1) { stykker.push(cur); cur = [line[i]]; km = 0; }
  }
  return stykker.map((p) => {
    const la = p.map((x) => x[0]), lo = p.map((x) => x[1]), mlo = margin / Math.cos((la[0] * Math.PI) / 180);
    return [Math.min(...lo) - mlo, Math.min(...la) - margin, Math.max(...lo) + mlo, Math.max(...la) + margin].map((v) => v.toFixed(5)).join(",");
  });
}

async function geoapify(line, kat) {
  const key = window.GEOAPIFY_KEY;
  if (!key) throw new Error("Mangler nøgle");
  const K = KATEGORIER[kat], margin = K.maxM / 111000 + 0.002;
  const fund = [];
  for (const rect of ruteStykker(line, margin)) {
    const url = `https://api.geoapify.com/v2/places?categories=${K.geo}&filter=rect:${rect}&limit=200&lang=da&apiKey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    (d.features || []).forEach((f) => {
      const p = f.properties || {};
      if (p.lat == null) return;
      fund.push([Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, kat, p.name || p.brand || "", p.opening_hours || p.datasource?.raw?.opening_hours || ""]);
    });
  }
  return fund;
}

function cacheNoegle(r, kat) {
  const a = r.line[0], b = r.line[r.line.length - 1];
  return `${r.id}|${kat}|${r.line.length}|${a}|${b}`;
}

// Steder i én kategori langs ruten, sorteret efter km. Gemmes lokalt (max 40 opslag).
async function stederFor(r, kat) {
  const nk = cacheNoegle(r, kat);
  if (stedCache[nk]) return stedCache[nk];
  const gemt = lsGet(STED_KEY, {});
  let raa = gemt[nk] && Date.now() - gemt[nk].t < 30 * 86400000 ? gemt[nk].s : null;
  if (!raa) {
    raa = await geoapify(r.line, kat);
    gemt[nk] = { t: Date.now(), s: raa };
    const noegler = Object.keys(gemt).sort((x, y) => gemt[y].t - gemt[x].t);
    noegler.slice(40).forEach((k) => delete gemt[k]);
    lsSet(STED_KEY, gemt);
  }
  const set = new Set();
  const liste = raa.filter((s) => { const k = s[0] + "," + s[1]; if (set.has(k)) return false; set.add(k); return true; })
    .map(([lat, lon, k, navn, aab]) => ({ pos: [lat, lon], kat: k, navn, aab, ...paaRuten([lat, lon], r.line, r.km) }))
    .filter((s) => s.m <= KATEGORIER[kat].maxM)
    .sort((a, b) => a.km - b.km);
  stedCache[nk] = liste;
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
  list.innerHTML = `<div class="empty">Søger efter ${K.navn.toLowerCase()} langs ruten…</div>`;
  let steder;
  try { steder = await stederFor(r, kat); }
  catch (e) {
    list.innerHTML = `<div class="card">${e && e.message === "Mangler nøgle" ? "Stedsøgning er ikke sat op endnu." : "Kunne ikke hente steder lige nu – er du offline?"}
      <div class="btn-row" style="margin:10px 0 0"><a class="btn secondary" target="_blank" rel="noopener" href="${soegLink(r, kat)}">Søg ${K.navn.toLowerCase()} i Kort</a></div></div>`;
    return;
  }
  if (!$("#uvList") || !view.querySelector(`#uvChips .chip.on[data-kat="${kat}"]`)) return; // brugeren har valgt noget andet
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
    </div>`).join("") + `<p class="muted pad">Data fra <a href="https://www.geoapify.com/" target="_blank" rel="noopener" style="color:var(--accent)">Geoapify</a> og OpenStreetMap – åbningstider kan være forældede.</p>`
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
    Object.keys(stedCache).filter((k) => k.startsWith(maal.id + "|")).forEach((k) => delete stedCache[k]);
    if ((DB.mineRuter || []).some((x) => x.id === maal.id)) save();
    toast(`${stop.navn} er lagt ind som stop`);
    if (maal.id === r.id) renderRute(r.id); else location.hash = "#rute/" + maal.id;
  } catch {
    toast("Kunne ikke lægge ruten om lige nu");
    knap.disabled = false; knap.textContent = "Tilføj som stop";
  }
}
