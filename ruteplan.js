"use strict";
/* ===================== Lav min egen rute =====================
   Vælg start og ønsket længde → appen lægger en rundtur.
   Metode: punkter lægges på en cirkel der går gennem startpunktet; ruten beregnes
   på rigtige veje med Mapbox (eller OSRM som reserve). Cirklens størrelse justeres indtil
   længden passer (±10 %). Der prøves nogle varianter, og den med færrest km på
   E-veje (motorvej) og mindst "frem og tilbage" vælges. */

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const MAPBOX = "https://api.mapbox.com/directions/v5/mapbox/driving/";
const PLAN_KEY = "mcapp.plan";
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

async function osrmRute(punkter) {
  const coords = punkter.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
  let d;
  if (window.MAPBOX_TOKEN) {
    try { d = await hentRute(MAPBOX, coords, "&access_token=" + window.MAPBOX_TOKEN); }
    catch (e) { console.warn("Mapbox fejlede, bruger OSRM", e); }
  }
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

async function lavRute({ start, km, retning, stil = "" }, onProgress) {
  const antal = stil ? 5 : 3;
  const varianter = retning === ""
    ? Array.from({ length: antal }, (_, i) => (Math.random() * 72 + i * 72) % 360)
    : (stil ? [-35, -15, 0, 15, 35] : [-25, 0, 25]).map((d) => (RETNING_GRADER[retning] + d + 360) % 360);
  const n = km < 60 ? 3 : km < 150 ? 4 : 5;
  let radius = km / (2 * Math.PI * 1.3);
  const kandidater = [];
  for (let v = 0; v < varianter.length; v++) {
    const grader = varianter[v];
    let res = null;
    for (let forsoeg = 0; forsoeg < (stil ? 2 : 3); forsoeg++) {
      onProgress && onProgress(`Beregner forslag ${v + 1} af ${varianter.length}…`);
      res = await osrmRute([start, ...cirkelPunkter(start, radius, grader, n), start]);
      const afv = Math.abs(res.km - km) / km;
      radius *= km / res.km; // lær af resultatet – også til de næste forslag
      if (afv <= 0.1) break;
      await vent(400); // skån den gratis tjeneste
    }
    res.grader = grader;
    res.basis = Math.abs(res.km - km) / km + (res.eKm / res.km) * 2 + gentagelse(res.line) * 3;
    res.sving = svingPrKm(res.line);
    if (stil === "bakket") {
      onProgress && onProgress(`Måler højder på forslag ${v + 1}…`);
      try { res.stigning = await stigningPrKm(res.line, res.km); } catch { res.stigning = 0; }
    }
    kandidater.push(res);
    if (!stil && res.basis < 0.1) break; // godt nok
    await vent(400);
  }
  // Vælg: basis (længde, motorvej, frem-og-tilbage) minus bonus for den valgte stil
  const maal = { snoet: (k) => k.sving, bakket: (k) => k.stigning || 0, smaa: (k) => k.smaa }[stil];
  const maks = maal ? Math.max(...kandidater.map(maal), 1e-9) : 1;
  kandidater.forEach((k) => (k.score = k.basis - (maal ? 0.6 * (maal(k) / maks) : 0)));
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
  const p = Object.assign({ by: "Hobro", km: 100, retning: "", stil: "" }, lsGet(PLAN_KEY, {}));
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
  $("#stilChips").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    p.stil = b.dataset.stil; gem();
    view.querySelectorAll("#stilChips .chip").forEach((c) => c.classList.toggle("on", c === b));
    $("#stilTekst").textContent = STILE[p.stil].tekst + (p.stil ? " Tager lidt længere tid, fordi der laves flere forslag." : "");
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
    const r = await lavRute({ start: s.punkt, km: p.km, retning: p.retning, stil: p.stil }, (t) => (status.textContent = t));
    const km = Math.round(r.km);
    const retning = p.retning ? RETNINGER[p.retning].toLowerCase() : retningsNavn(r.grader);
    sidstePlan = {
      id: "egen-" + uid(),
      egen: true,
      navn: `${p.stil ? STILE[p.stil].navn + " rundtur" : "Rundtur"} fra ${s.navn === "min position" ? "min position" : s.navn}, ${km} km mod ${retning}`,
      region: "", vejtype: [], start: s.navn === "min position" ? "Min position" : s.navn, slut: "Samme sted (rundtur)",
      beskrivelse: `Automatisk lavet ${p.stil ? STILE[p.stil].navn.toLowerCase() + " " : ""}rundtur på ca. ${km} km mod ${retning}${r.eKm > 1 ? `. Ca. ${Math.round(r.eKm)} km på E-vej/motorvej.` : "."} Tjek ruten på kortet før du kører – den er beregnet automatisk og kender ikke vejarbejde eller lukkede veje.`,
      stop: [], kilder: [],
      km, min: Math.round(r.min), line: forenkl(r.line, 0.00008), oprettet: today(),
      stil: p.stil, stats: { sving: Math.round(r.sving), stigning: r.stigning != null ? Math.round(r.stigning * 10) / 10 : null, smaa: Math.round(r.smaa * 100) }
    };
    // Ærlig besked hvis området ikke har meget af det ønskede
    const svag = { bakket: r.stigning != null && r.stigning < 5, snoet: r.sving < 40, smaa: r.smaa < 0.4 }[p.stil];
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
