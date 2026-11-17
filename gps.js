"use strict";
/* ===================== GPS =====================
   1) Min position på kortet: knap på alle kort, viser en blå prik (og følger med, når den er slået til).
   2) Optag tur: måler km, tid og spor mens appen er åben. Gemmes i dagbogen med benzinforbrug.
   En webapp på iPhone får kun GPS, mens skærmen er tændt og appen er åben. Skærmen holdes tændt
   (Wake Lock), og huller (fx skærmen slukket) lukkes med en lige linje, som turen gøres opmærksom på. */

const OPTAG_KEY = "mcapp.optagelse";
const kmMellem = ([a, b], [c, d]) => {
  const R = 6371, r = Math.PI / 180, dLat = (c - a) * r, dLon = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const fmtVarighed = (ms) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`; };

const placeringIkkeTilladt = () => "Placering er ikke tilladt – slå det til under Indstillinger › " + (window.mcNative ? "Apps › MC-app › Placering" : "Safari › Placering");

/* ---------- 1) Min position på kortet ---------- */
let posWatch = null, posLag = null, posFoelg = false;

function stopPosition() {
  if (posWatch != null) navigator.geolocation.clearWatch(posWatch);
  posWatch = null; posLag = null; posFoelg = false;
}

function tilfoejPositionsknap(m) {
  if (!navigator.geolocation) return;
  const Knap = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const b = L.DomUtil.create("button", "pos-knap");
      b.type = "button"; b.title = "Min position"; b.setAttribute("aria-label", "Vis min position");
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2Zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>';
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", () => {
        if (posWatch == null) { startPosition(m, b); return; }
        posFoelg = !posFoelg; b.classList.toggle("foelg", posFoelg);
        if (posFoelg && posLag) m.setView(posLag.prik.getLatLng(), Math.max(m.getZoom(), 14));
      });
      return b;
    }
  });
  new Knap().addTo(m);
  // Stop med at følge, når man selv flytter kortet
  m.on("dragstart", () => { posFoelg = false; document.querySelectorAll(".pos-knap").forEach((x) => x.classList.remove("foelg")); });
}

function startPosition(m, knap) {
  knap.classList.add("aktiv", "foelg"); posFoelg = true;
  let foerste = true;
  posWatch = navigator.geolocation.watchPosition((p) => {
    const ll = [p.coords.latitude, p.coords.longitude];
    if (!posLag) {
      posLag = {
        ring: L.circle(ll, { radius: p.coords.accuracy, color: "#1c7ed6", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m),
        prik: L.circleMarker(ll, { radius: 7, color: "#fff", weight: 3, fillColor: "#1c7ed6", fillOpacity: 1 }).bindTooltip("Du er her").addTo(m)
      };
    } else { posLag.prik.setLatLng(ll); posLag.ring.setLatLng(ll).setRadius(p.coords.accuracy); }
    if (posFoelg) foerste ? m.setView(ll, Math.max(m.getZoom(), 14)) : m.panTo(ll);
    foerste = false;
  }, (e) => {
    stopPosition(); knap.classList.remove("aktiv", "foelg");
    toast(e.code === 1 ? placeringIkkeTilladt() : "Kunne ikke finde din position");
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

/* ---------- 2) Optag tur ---------- */
// Tilstanden gemmes løbende, så en optagelse overlever at appen genindlæses
let optag = lsGet(OPTAG_KEY, null); // { start, rute, pkt: [[lat,lon,tid]], km, gabKm, pauseMs, pauseFra, kører }
let optagWatch = null, wakeLock = null, optagTimer = null, sidsteFix = null, afvist = 0;

const gemOptag = () => lsSet(OPTAG_KEY, optag);
const koertMs = () => optag ? (optag.slut || Date.now()) - optag.start - optag.pauseMs - (optag.pauseFra ? Date.now() - optag.pauseFra : 0) : 0;

async function holdSkaermTaendt() {
  try { if ("wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } } catch { /* ikke understøttet */ }
}

// I iPhone-appen kommer punkter fra tiden med slukket skærm samlet (iBatch): gem og tegn kun én gang til sidst
const iBatch = () => !!(window.mcNative && window.mcNative.iBatch);
const opdaterOptag = (gem) => { if (iBatch()) return; if (gem) gemOptag(); visOptag(); };
window.addEventListener("mcgps-batch", () => { if (optag) { gemOptag(); visOptag(); } });

function nytPunkt(p) {
  if (!optag || optag.pauseFra) return;
  const { latitude: lat, longitude: lon, accuracy } = p.coords;
  sidsteFix = { acc: accuracy, t: Date.now() };
  if (accuracy > 50) { opdaterOptag(); return; } // for upræcist (fx lige efter start)
  const ny = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, p.timestamp || Date.now()];
  const forrige = optag.pkt[optag.pkt.length - 1];
  if (forrige) {
    const d = kmMellem(forrige, ny), timer = (ny[2] - forrige[2]) / 3600000;
    if (d < 0.01) { opdaterOptag(); return; }              // under 10 m: GPS-støj, stå stille
    if (timer > 0 && d / timer > 250) {                     // urealistisk spring: afvis …
      if (++afvist < 3) { opdaterOptag(); return; }
      optag.pkt.push(ny); afvist = 0; opdaterOptag(true); return; // … men 3 i træk = det forrige punkt var forkert; start forfra herfra uden km
    }
    afvist = 0;
    if (ny[2] - forrige[2] > 60000 && d > 0.3) optag.gabKm += d; // hul (skærm slukket): lige linje
    optag.km += d;
  }
  optag.pkt.push(ny); opdaterOptag(true);
}

function startGps() {
  if (optagWatch != null || !optag) return;
  optagWatch = navigator.geolocation.watchPosition(nytPunkt, (e) => {
    if (e.code === 1) { toast(placeringIkkeTilladt()); stopGps(); }
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000, baggrund: true }); // baggrund: kun iPhone-appen (fortsætter med slukket skærm)
  holdSkaermTaendt();
  clearInterval(optagTimer); optagTimer = setInterval(visOptag, 1000);
  visOptagMaerke();
}

function stopGps() {
  if (optagWatch != null) navigator.geolocation.clearWatch(optagWatch);
  optagWatch = null; clearInterval(optagTimer);
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null; visOptagMaerke();
}

// I iPhone-appen: fortsæt en igangværende optagelse med det samme, når appen (gen)starter
if (window.mcNative && optag && !optag.slut && !optag.pauseFra) setTimeout(startGps, 0);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && optag && !optag.pauseFra) holdSkaermTaendt();
});

function startOptagelse(ruteId) {
  if (!navigator.geolocation) { toast("Denne telefon har ikke GPS i browseren"); return; }
  optag = { start: Date.now(), rute: ruteId || "", pkt: [], km: 0, gabKm: 0, pauseMs: 0, pauseFra: null };
  gemOptag(); startGps();
  if (location.hash === "#optag") renderOptag(); else location.hash = "#optag";
}

function pauseOptagelse() {
  if (!optag) return;
  if (optag.pauseFra) { optag.pauseMs += Date.now() - optag.pauseFra; optag.pauseFra = null; startGps(); }
  else { optag.pauseFra = Date.now(); stopGps(); }
  gemOptag(); renderOptag();
}

function afslutOptagelse() {
  if (!optag) return;
  if (optag.pauseFra) { optag.pauseMs += Date.now() - optag.pauseFra; optag.pauseFra = null; }
  if (!optag.slut) optag.slut = Date.now();
  stopGps(); gemOptag();
  const ms = koertMs(), km = Math.round(optag.km * 10) / 10;
  const b = Object.assign({ kml: "", oktan: "95" }, lsGet("mcapp.benzin", {}));
  const kml = parseFloat(String(b.kml).replace(",", "."));
  const pris = lsGet("mcapp.benzinpris", null);
  const lpris = pris && pris.priser ? pris.priser[b.oktan] : null;
  const benzin = kml > 0 ? { liter: Math.round((km / kml) * 10) / 10, oktan: b.oktan, kr: lpris ? Math.round((km / kml) * lpris) : null } : null;
  const noter = [
    `Optaget med GPS: ${fmtVarighed(ms)} i bevægelse${ms > 60000 ? `, gns. ${Math.round(km / (ms / 3600000))} km/t` : ""}.`,
    optag.gabKm > 1 ? `Heraf ca. ${Math.round(optag.gabKm)} km målt i lige linje, mens GPS'en var afbrudt.` : "",
    benzin ? `Benzin: ca. ${kr(benzin.liter, 1)} l ${benzin.oktan} oktan${benzin.kr != null ? ` ≈ ${benzin.kr} kr` : ""}.` : ""
  ].filter(Boolean).join(" ");
  const spor = optag.pkt.length > 1 ? forenkl(optag.pkt.map(([la, lo]) => [la, lo]), 0.00005) : [];
  editTrip(null, optag.rute || null, { dato: new Date(optag.start).toLocaleDateString("sv-SE"), km, noter, ekstra: { gps: true, spor, minutter: Math.round(ms / 60000), benzin } },
    () => { optag = null; localStorage.removeItem(OPTAG_KEY); visOptagMaerke(); });
}

function kasserOptagelse() {
  if (!confirm("Kassér optagelsen? Den kan ikke findes igen.")) return;
  stopGps(); optag = null; localStorage.removeItem(OPTAG_KEY); visOptagMaerke(); location.hash = "#ture";
}

// Lille "● Optager"-mærke i toppen, når man er på en anden side
function visOptagMaerke() {
  let m = $("#optagMaerke");
  if (!m) {
    m = document.createElement("button"); m.id = "optagMaerke"; m.className = "optag-maerke";
    m.onclick = () => (location.hash = "#optag");
    document.querySelector(".topbar").appendChild(m);
  }
  const vis = optag && !optag.slut && location.hash !== "#optag";
  m.classList.toggle("hidden", !vis);
  if (vis) m.textContent = optag.pauseFra ? "❚❚ Pause" : "● Optager";
}
window.addEventListener("hashchange", visOptagMaerke);

let optagKort = null, optagLinje = null;
function renderOptag() {
  setHeader("Optag tur", true);
  if (optag && optag.slut) {
    // Stoppet, men turen er ikke gemt endnu (fx hvis gem-arket blev lukket)
    destroyMap();
    view.innerHTML = `
      <div class="card"><b>Optagelsen er stoppet</b><div class="muted">${kr(optag.km, 1)} km · ${fmtVarighed(koertMs())}. Turen er ikke gemt endnu.</div></div>
      <div class="btn-row"><button class="btn" id="gemOpt">Gem i dagbogen</button><button class="btn danger" id="kasserOpt">Kassér</button></div>`;
    $("#gemOpt").onclick = afslutOptagelse;
    $("#kasserOpt").onclick = kasserOptagelse;
    return;
  }
  if (!optag) {
    destroyMap();
    view.innerHTML = `
      <div class="card">
        <p style="margin-top:0">Appen måler, hvor langt du kører, hvor længe, og hvilken vej. Turen gemmes i dagbogen med benzinforbrug.</p>
        <p class="muted">${window.mcNative
          ? "GPS'en bliver ved, også når skærmen er slukket eller du bruger andre apps, til du selv stopper optagelsen. En blå markering øverst på skærmen viser, at den kører."
          : "Vigtigt på iPhone: GPS virker kun, mens appen er åben og skærmen er tændt. Sæt telefonen i en holder, gerne med strøm. Appen forsøger selv at holde skærmen tændt."}</p>
      </div>
      <div class="btn-row"><button class="btn block" id="startOpt">▶︎ Start optagelse</button></div>`;
    $("#startOpt").onclick = () => startOptagelse("");
    return;
  }
  const r = optag.rute ? findRoute(optag.rute) : null;
  view.innerHTML = `
    <div id="map" class="map small"></div>
    ${r ? `<div class="pad" style="padding-bottom:0"><b>${esc(r.navn)}</b></div>` : ""}
    <div class="card">
      <div class="stats">
        <div><div class="stat" id="optKm">0,0</div><div class="muted">km</div></div>
        <div><div class="stat" id="optTid">0 min</div><div class="muted">i bevægelse</div></div>
        <div><div class="stat" id="optFart">–</div><div class="muted">gns. km/t</div></div>
      </div>
      <div class="muted" id="optStatus" style="margin-top:10px;font-size:13px"></div>
    </div>
    <div class="btn-row">
      <button class="btn secondary" id="pauseOpt">${optag.pauseFra ? "▶︎ Fortsæt" : "❚❚ Pause"}</button>
      <button class="btn" id="stopOpt">■ Stop og gem</button>
    </div>
    <div class="btn-row"><button class="btn danger" id="kasserOpt">Kassér optagelse</button></div>`;
  $("#pauseOpt").onclick = pauseOptagelse;
  $("#stopOpt").onclick = afslutOptagelse;
  $("#kasserOpt").onclick = kasserOptagelse;
  destroyMap();
  map = optagKort = makeMap($("#map"));
  if (r && r.line) L.polyline(r.line, { color: "#868e96", weight: 4, opacity: 0.7, dashArray: "6 6" }).addTo(map);
  optagLinje = L.polyline(optag.pkt.map(([a, b]) => [a, b]), { color: "#e8590c", weight: 5 }).addTo(map);
  if (optag.pkt.length) map.setView(optag.pkt[optag.pkt.length - 1], 14);
  else if (r && r.line) map.fitBounds(L.polyline(r.line).getBounds(), { padding: [20, 20] });
  else map.setView([56.6, 9.8], 9);
  if (!optag.pauseFra) startGps();
  visOptag();
}

function visOptag() {
  if (!optag || location.hash !== "#optag" || !$("#optKm")) return;
  const ms = koertMs();
  $("#optKm").textContent = kr(optag.km, 1);
  $("#optTid").textContent = fmtVarighed(ms);
  $("#optFart").textContent = ms > 60000 ? Math.round(optag.km / (ms / 3600000)) : "–";
  const st = optag.pauseFra ? "På pause – GPS er slukket."
    : !sidsteFix ? "Venter på GPS…"
    : sidsteFix.acc > 50 ? `Svagt GPS-signal (±${Math.round(sidsteFix.acc)} m)…`
    : `GPS ok (±${Math.round(sidsteFix.acc)} m)${wakeLock ? " · skærmen holdes tændt" : ""}.`;
  $("#optStatus").textContent = st;
  if (optagLinje && map === optagKort) {
    const n = optagLinje.getLatLngs().length;
    for (let i = n; i < optag.pkt.length; i++) optagLinje.addLatLng(optag.pkt[i].slice(0, 2));
    if (optag.pkt.length > n && optag.pkt.length) map.panTo(optag.pkt[optag.pkt.length - 1].slice(0, 2));
  }
}

// En optagelse i gang ved genstart fortsætter af sig selv
window.addEventListener("DOMContentLoaded", () => { if (optag && !optag.slut && !optag.pauseFra) startGps(); visOptagMaerke(); });
