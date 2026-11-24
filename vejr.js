"use strict";
/* ===================== Vejr: "MC-vejr i dag?" =====================
   Prognose fra Open-Meteo (gratis, ingen nøgle). Vurdering ja/måske/nej ud fra
   temperatur, regn, vind og risiko for glat føre i køretiden (nu → kl. 21,
   eller i morgen kl. 8–21 hvis det er sent). Seneste prognose gemmes til offline-brug. */

const BYER = {
  "Aars": [56.8, 9.52], "Hobro": [56.64, 9.79], "Randers": [56.46, 10.04],
  "København": [55.68, 12.57], "Aarhus": [56.16, 10.2], "Odense": [55.4, 10.39], "Aalborg": [57.05, 9.92],
  "Esbjerg": [55.48, 8.45], "Vejle": [55.71, 9.54], "Herning": [56.14, 8.97],
  "Silkeborg": [56.17, 9.55], "Roskilde": [55.64, 12.08], "Næstved": [55.23, 11.76], "Hillerød": [55.93, 12.31],
  "Sønderborg": [54.91, 9.79], "Holstebro": [56.36, 8.62], "Frederikshavn": [57.44, 10.54], "Svendborg": [55.06, 10.61],
  "Rønne": [55.1, 14.7]
};
const VKEY = "mcapp.vejr";
const NIV = { ja: 0, maaske: 1, nej: 2 };
const FROST_CODES = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86];
const TORDEN = [95, 96, 99];

function vejrState() { return lsGet(VKEY, { sted: null, data: null }); }

function wxIcon(code) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (TORDEN.includes(code)) return "⛈️";
  if (FROST_CODES.includes(code) || (code >= 71 && code <= 86)) return "❄️";
  if (code >= 51) return "🌧️";
  return "⛅";
}

// Vurdering for én time (bruges til farver i timeoversigten og "bedste tidsrum")
function hourLevel(h) {
  if (h.snow > 0 || FROST_CODES.includes(h.code) || TORDEN.includes(h.code) || h.temp <= 0 || h.gust >= 20 || h.precip >= 1.5 || (h.temp <= 3 && h.precip > 0)) return "nej";
  if (h.temp <= 3 || h.prob >= 40 || h.precip > 0.1 || h.gust >= 14 || h.wind >= 10 || h.temp >= 30) return "maaske";
  return "ja";
}

// Samlet vurdering for køretiden. Returnerer niveau + begrundelser.
function vurder(hours, pastMin) {
  const r = [];
  const add = (niv, tekst) => r.push({ niv, tekst });
  const tMin = Math.min(...hours.map((h) => h.temp));
  const tMax = Math.max(...hours.map((h) => h.temp));
  const precip = hours.reduce((s, h) => s + h.precip, 0);
  const prob = Math.max(...hours.map((h) => h.prob));
  const wind = Math.max(...hours.map((h) => h.wind));
  const gust = Math.max(...hours.map((h) => h.gust));
  const snow = hours.reduce((s, h) => s + h.snow, 0);
  const codes = hours.map((h) => h.code);
  const f = (n) => n.toLocaleString("da-DK", { maximumFractionDigits: 1 });

  // Glat føre
  if (snow > 0 || codes.some((c) => FROST_CODES.includes(c))) add("nej", "Sne eller isslag i prognosen – glat føre");
  else if (tMin <= 0) add("nej", `Frost (ned til ${f(tMin)} °C) – risiko for is på vejen`);
  else if (tMin <= 3 && precip > 0) add("nej", `Kulde (${f(tMin)} °C) og nedbør – risiko for glat føre`);
  else if (tMin <= 3) add("maaske", `Tæt på frysepunktet (${f(tMin)} °C) – pas på glatte pletter`);
  else if (pastMin <= 0 && tMin <= 6) add("maaske", "Nattefrost – vejen kan være glat i skygge og på broer");

  // Torden og vind
  if (codes.some((c) => TORDEN.includes(c))) add("nej", "Torden i prognosen");
  if (gust >= 20) add("nej", `Meget kraftige vindstød (op til ${f(gust)} m/s)`);
  else if (gust >= 14 || wind >= 10) add("maaske", `Kraftig vind (${f(wind)} m/s, stød op til ${f(gust)} m/s) – pas på broer og åbne strækninger`);

  // Regn
  if (precip >= 5) add("nej", `Meget regn (${f(precip)} mm)`);
  else if (precip >= 3 && prob >= 70) add("nej", `Regn det meste af dagen (${f(precip)} mm)`);
  else if (precip >= 0.5 || prob >= 50) add("maaske", `Regn ventes (${f(precip)} mm, op til ${prob} % risiko) – tag regntøj med`);
  else if (prob >= 30) add("maaske", `Risiko for byger (op til ${prob} %)`);

  // Temperatur
  if (tMax >= 30) add("maaske", `Meget varmt (op til ${f(tMax)} °C) – husk væske`);
  else if (tMax < 10 && tMin > 3) add("maaske", `Koldt (højst ${f(tMax)} °C) – tag varmt tøj på`);

  const niv = r.reduce((m, x) => (NIV[x.niv] > NIV[m] ? x.niv : m), "ja");
  return { niv, grunde: r, tMin, tMax, precip, prob, wind, gust };
}

function bedsteTidsrum(hours) {
  let best = null, start = null;
  hours.forEach((h, i) => {
    if (h.level === "ja") { if (start === null) start = i; }
    else start = null;
    if (start !== null && (!best || i - start > best[1] - best[0])) best = [start, i];
  });
  if (!best) return null;
  const from = hours[best[0]].time.slice(11, 13), to = String(Number(hours[best[1]].time.slice(11, 13)) + 1).padStart(2, "0");
  return `${from}–${to}`;
}

async function hentPrognose(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(2), longitude: lon.toFixed(2),
    hourly: "temperature_2m,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,wind_gusts_10m",
    wind_speed_unit: "ms", timezone: "Europe/Copenhagen", past_hours: "12", forecast_hours: "48"
  });
  const res = await fetch("https://api.open-meteo.com/v1/forecast?" + p);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function analyser(data) {
  const H = data.hourly;
  const hours = H.time.map((time, i) => ({
    time, temp: H.temperature_2m[i], prob: H.precipitation_probability[i] ?? 0, precip: H.precipitation[i] ?? 0,
    snow: H.snowfall[i] ?? 0, code: H.weather_code[i], wind: H.wind_speed_10m[i], gust: H.wind_gusts_10m[i]
  }));
  // Aktuel dansk tid som "YYYY-MM-DDTHH"
  const nu = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Copenhagen" }).replace(" ", "T").slice(0, 13);
  const idag = nu.slice(0, 10), time = Number(nu.slice(11, 13));
  let dag = idag, fra = Math.max(time, 6), label = "i dag";
  if (time >= 20) {
    const t = new Date(idag + "T12:00:00"); t.setDate(t.getDate() + 1);
    dag = t.toISOString().slice(0, 10); fra = 8; label = "i morgen";
  }
  const vindue = hours.filter((h) => h.time.slice(0, 10) === dag && Number(h.time.slice(11, 13)) >= fra && Number(h.time.slice(11, 13)) <= 21);
  const past = hours.filter((h) => h.time.slice(0, 13) <= nu).slice(-12);
  const pastMin = past.length ? Math.min(...past.map((h) => h.temp)) : 99;
  vindue.forEach((h) => (h.level = hourLevel(h)));
  return { label, vindue, res: vindue.length ? vurder(vindue, pastMin) : null, bedst: bedsteTidsrum(vindue) };
}

const SVAR = {
  ja: { ord: "Ja", tekst: "Fint MC-vejr – god tur!", cls: "ok" },
  maaske: { ord: "Måske", tekst: "Kan køres, men vær forberedt", cls: "soon" },
  nej: { ord: "Nej", tekst: "Lad hellere MC'en stå", cls: "due" }
};

let vejrHenter = false;

async function renderVejr(forceRefresh) {
  setHeader("MC-vejr");
  const st = vejrState();
  if (!st.sted) {
    view.innerHTML = `
      <div class="vejr-start">
        <div class="vejr-start-ikon">🏍️</div>
        <h2>Er det MC-vejr i dag?</h2>
        <p>Appen kigger på temperatur, regn, vind og glat føre og svarer ja, måske eller nej. Den husker dit valg til næste gang.</p>
        <button class="btn block" id="gpsBtn">📍 Brug min position</button>
      </div>
      <div class="section-title">Eller vælg en by</div>
      ${byGitter()}`;
    $("#gpsBtn").onclick = brugPosition;
    vaelgByKlik(view);
    return;
  }

  const gammel = !st.data || Date.now() - st.data.hentet > 30 * 60 * 1000;
  if ((gammel || forceRefresh) && navigator.onLine && !vejrHenter) {
    if (!st.data) view.innerHTML = `<div class="empty">Henter prognose for ${esc(st.sted.navn)}…</div>`;
    vejrHenter = true;
    try {
      const data = await hentPrognose(st.sted.lat, st.sted.lon);
      st.data = { hentet: Date.now(), raw: data };
      lsSet(VKEY, st);
    } catch {
      if (!st.data) { view.innerHTML = `<div class="empty">Kunne ikke hente vejret. Tjek forbindelsen og prøv igen.</div><div class="btn-row"><button class="btn" onclick="renderVejr(true)">Prøv igen</button></div>`; vejrHenter = false; return; }
      toast("Kunne ikke opdatere – viser seneste prognose");
    }
    vejrHenter = false;
  }
  if (!st.data) { view.innerHTML = `<div class="empty">Ingen prognose gemt. Gå online for at hente vejret.</div>`; return; }
  if (!location.hash.startsWith("#vejr")) return; // brugeren har skiftet fane mens vi hentede

  const a = analyser(st.data.raw);
  const hentet = new Date(st.data.hentet).toLocaleString("da-DK", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  if (!a.res) { view.innerHTML = `<div class="empty">Prognosen er for gammel. Opdater når du er online.</div>`; return; }
  const s = SVAR[a.res.niv];
  const f = (n) => n.toLocaleString("da-DK", { maximumFractionDigits: 1 });

  view.innerHTML = `
    <div class="verdict ${s.cls}">
      <div class="muted-light">MC-vejr ${a.label}? · ${esc(st.sted.navn)}</div>
      <div class="verdict-word">${s.ord}</div>
      <div>${s.tekst}</div>
      <div class="verdict-fakta">
        <span>${hyppigsteIkon(a.vindue)}</span>
        <span>${Math.round(a.res.tMin)} til ${Math.round(a.res.tMax)} °C</span>
        <span>💧 ${a.res.prob} %</span>
        <span>💨 ${Math.round(a.res.wind)} m/s</span>
      </div>
    </div>
    ${a.res.grunde.length ? `<div class="card">
      <ul class="stops">${a.res.grunde.map((g) => `<li class="row"><span class="status ${SVAR[g.niv].cls}"></span><span class="grow">${esc(g.tekst)}</span></li>`).join("")}</ul>
    </div>` : `<div class="card">Tørt, mildt og ikke for meget vind i køretiden.</div>`}
    ${a.bedst && a.res.niv !== "ja" && a.vindue.some((h) => h.level !== "ja") ? `<div class="card"><b>Bedste tidsrum ${a.label}:</b> kl. ${a.bedst}</div>` : ""}
    <div class="card">
      <div class="kv">
        <div>Temperatur</div><div>${f(a.res.tMin)} til ${f(a.res.tMax)} °C</div>
        <div>Nedbør i alt</div><div>${f(a.res.precip)} mm</div>
        <div>Max regnrisiko</div><div>${a.res.prob} %</div>
        <div>Vind / stød</div><div>${f(a.res.wind)} / ${f(a.res.gust)} m/s</div>
      </div>
    </div>
    <div class="section-title">Time for time ${a.label}</div>
    <div class="hours">${a.vindue.map((h) => `
      <div class="hour ${SVAR[h.level].cls}">
        <div class="muted">${h.time.slice(11, 13)}</div>
        <div class="wx">${wxIcon(h.code)}</div>
        <b>${Math.round(h.temp)}°</b>
        <div class="muted">${h.prob}%</div>
        <div class="muted">${Math.round(h.wind)}/${Math.round(h.gust)}</div>
      </div>`).join("")}</div>
    <p class="muted pad" style="margin:0">Timer: regnrisiko og vind/stød i m/s. Farven viser vurderingen for den enkelte time.</p>
    <div class="btn-row">
      <button class="btn secondary" id="refreshBtn">Opdater</button>
      <button class="btn secondary" id="stedBtn">Skift sted</button>
    </div>
    <p class="muted pad">Hentet ${hentet}. Vejrdata fra <a href="https://open-meteo.com/" target="_blank" rel="noopener" style="color:var(--accent)">Open-Meteo</a>. Vurderingen er vejledende – kig altid selv på vejen og vejret.</p>
  `;
  $("#refreshBtn").onclick = () => renderVejr(true);
  $("#stedBtn").onclick = () => openSheet(`
    <h2>Skift sted</h2>
    <button class="btn block" id="gpsBtn2">📍 Brug min position</button>
    <div class="filter-label" style="margin:16px 4px 6px">Eller vælg en by</div>
    ${byGitter(st.sted.navn)}`, (sh) => { $("#gpsBtn2", sh).onclick = () => { closeSheet(); brugPosition(); }; vaelgByKlik(sh); });
}

function byGitter(valgt) {
  return `<div class="bygitter">${Object.keys(BYER).map((b) => `<button class="chip ${b === valgt ? "on" : ""}" data-by="${esc(b)}">${esc(b)}</button>`).join("")}</div>`;
}
function vaelgByKlik(el) {
  el.querySelectorAll("[data-by]").forEach((b) => (b.onclick = () => { closeSheet(); saetSted({ navn: b.dataset.by, lat: BYER[b.dataset.by][0], lon: BYER[b.dataset.by][1] }); }));
}

// Det vejr-ikon, der passer bedst på køretiden (det hyppigste)
function hyppigsteIkon(hours) {
  const c = {}; hours.forEach((h) => { const i = wxIcon(h.code); c[i] = (c[i] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

function saetSted(sted) {
  lsSet(VKEY, { sted, data: null });
  renderVejr(true);
}

function brugPosition() {
  if (!navigator.geolocation) { toast("Din telefon understøtter ikke placering"); return; }
  toast("Finder din position…");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      // Find nærmeste by til visning; koordinater afrundes til ca. 1 km før de sendes til vejrtjenesten
      const { latitude: lat, longitude: lon } = p.coords;
      const naer = Object.entries(BYER).sort((a, b) => Math.hypot(a[1][0] - lat, a[1][1] - lon) - Math.hypot(b[1][0] - lat, b[1][1] - lon))[0];
      const navn = Math.hypot(naer[1][0] - lat, naer[1][1] - lon) < 0.15 ? naer[0] : "Min position";
      saetSted({ navn, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
    },
    () => toast("Kunne ikke finde din position – vælg en by"),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
  );
}
