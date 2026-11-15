"use strict";
/* ===================== Lav min egen rute =====================
   Vælg start og ønsket længde → appen lægger en rundtur.
   Metode: punkter lægges på en cirkel der går gennem startpunktet; ruten beregnes
   på rigtige veje med OSRM (OpenStreetMap). Cirklens størrelse justeres indtil
   længden passer (±10 %). Der prøves nogle varianter, og den med færrest km på
   E-veje (motorvej) og mindst "frem og tilbage" vælges. */

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const PLAN_KEY = "mcapp.plan";
const RETNINGER = { "": "Tilfældig", N: "Nord", O: "Øst", S: "Syd", V: "Vest" };
const RETNING_GRADER = { N: 0, O: 90, S: 180, V: 270 };
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

async function osrmRute(punkter) {
  const coords = punkter.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const res = await fetch(`${OSRM}${coords}?overview=full&geometries=geojson&steps=true`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const d = await res.json();
  if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error(d.message || "Ingen rute");
  const r = d.routes[0];
  let eKm = 0;
  r.legs.forEach((leg) => leg.steps.forEach((s) => { if (/^E\s?\d/.test(s.ref || "")) eKm += s.distance / 1000; }));
  const line = r.geometry.coordinates.map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]);
  return { km: r.distance / 1000, min: r.duration / 60, eKm, line };
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

async function lavRute({ start, km, retning }, onProgress) {
  const varianter = retning === "" ? [0, 1, 2].map(() => Math.random() * 360) : [-25, 0, 25].map((d) => (RETNING_GRADER[retning] + d + 360) % 360);
  let bedst = null;
  for (let v = 0; v < varianter.length; v++) {
    const grader = varianter[v];
    const n = km < 60 ? 3 : km < 150 ? 4 : 5;
    let radius = km / (2 * Math.PI * 1.3);
    let res = null;
    for (let forsoeg = 0; forsoeg < 3; forsoeg++) {
      onProgress && onProgress(`Beregner forslag ${v + 1} af ${varianter.length}…`);
      res = await osrmRute([start, ...cirkelPunkter(start, radius, grader, n), start]);
      if (Math.abs(res.km - km) / km <= 0.1) break;
      radius *= km / res.km;
      await vent(400); // skån den gratis tjeneste
    }
    const score = Math.abs(res.km - km) / km + res.eKm / res.km * 2 + gentagelse(res.line) * 3;
    if (!bedst || score < bedst.score) bedst = { ...res, score, grader };
    if (score < 0.1) break; // godt nok
    await vent(400);
  }
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
  const p = Object.assign({ by: "Hobro", km: 100, retning: "" }, lsGet(PLAN_KEY, {}));
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
    <div class="btn-row"><button class="btn block" id="lavBtn">Lav rute</button></div>
    <div id="planStatus" class="pad muted"></div>
    <p class="muted pad">Ruten beregnes på OpenStreetMap-veje og forsøger at undgå motorvej. Kræver internet. Tryk igen for et nyt forslag.</p>
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
    status.textContent = p.by === "pos" ? "Finder din position…" : "";
    const s = await hentStart(p.by);
    const r = await lavRute({ start: s.punkt, km: p.km, retning: p.retning }, (t) => (status.textContent = t));
    const km = Math.round(r.km);
    const retning = p.retning ? RETNINGER[p.retning].toLowerCase() : retningsNavn(r.grader);
    sidstePlan = {
      id: "egen-" + uid(),
      egen: true,
      navn: `Rundtur fra ${s.navn === "min position" ? "min position" : s.navn}, ${km} km mod ${retning}`,
      region: "", vejtype: [], start: s.navn === "min position" ? "Min position" : s.navn, slut: "Samme sted (rundtur)",
      beskrivelse: `Automatisk lavet rundtur på ca. ${km} km mod ${retning}${r.eKm > 1 ? `. Ca. ${Math.round(r.eKm)} km på E-vej/motorvej.` : "."} Tjek ruten på kortet før du kører – den er beregnet automatisk og kender ikke vejarbejde eller lukkede veje.`,
      stop: [], kilder: [],
      km, min: Math.round(r.min), line: forenkl(r.line, 0.00008), oprettet: today()
    };
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
