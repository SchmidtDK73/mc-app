"use strict";
/* ===================== Ture: kørselsdagbog og pakkelister =====================
   Data ligger i appens lokale datasæt (DB.ture, DB.pakkelister),
   så de kommer med i Backup/Gendan. */

const STANDARD_LISTER = [
  { navn: "Dagstur", items: ["Kørekort", "Telefon og oplader", "Betalingskort", "Regntøj", "Ekstra handsker", "Solbriller / klart visir", "Vand og snacks", "Ørepropper", "Dækreparationssæt", "Lille værktøjssæt", "Førstehjælpskasse", "Refleksvest"] },
  { navn: "Weekendtur", items: ["Kørekort", "Telefon, oplader og powerbank", "Betalingskort", "Regntøj", "Termotøj / ekstra lag", "Ekstra handsker", "Skiftetøj", "Toiletsager", "Medicin", "Ørepropper", "Kædespray", "Dækreparationssæt og pumpe", "Værktøjssæt", "Førstehjælpskasse", "Stropper / net til bagage", "Hængelås / kædelås", "Overnatning bekræftet"] }
];

function pakkelister() {
  if (!Array.isArray(DB.pakkelister)) {
    DB.pakkelister = STANDARD_LISTER.map((l) => ({ id: uid(), navn: l.navn, items: l.items.map((t) => ({ id: uid(), tekst: t, ok: false })) }));
    save();
  }
  return DB.pakkelister;
}

function routeName(id) { const r = findRoute(id); return r ? r.navn : ""; }
function alleRuter() { return [...(DB.mineRuter || []), ...ROUTES]; }

function segment(active) {
  return `<div class="segment">
    <a href="#ture" class="${active === "dagbog" ? "on" : ""}">Dagbog</a>
    <a href="#ture/pak" class="${active === "pak" ? "on" : ""}">Pakkelister</a>
  </div>`;
}

function renderTure(parts) {
  if (parts[0] === "pak" && parts[1]) return renderPakkeliste(parts[1]);
  if (parts[0] === "pak") return renderPakkelister();
  renderDagbog();
}

/* ---------- Dagbog ---------- */
function renderDagbog() {
  setHeader("Ture");
  const ture = [...(DB.ture || [])].sort((a, b) => b.dato.localeCompare(a.dato));
  const aar = String(new Date().getFullYear());
  const iAar = ture.filter((t) => t.dato.startsWith(aar));
  const sum = (arr) => arr.reduce((s, t) => s + (Number(t.km) || 0), 0);

  view.innerHTML = `
    ${segment("dagbog")}
    <div class="card">
      <div class="stats">
        <div><div class="stat">${iAar.length}</div><div class="muted">ture i ${aar}</div></div>
        <div><div class="stat">${sum(iAar).toLocaleString("da-DK")}</div><div class="muted">km i ${aar}</div></div>
        <div><div class="stat">${sum(ture).toLocaleString("da-DK")}</div><div class="muted">km i alt</div></div>
      </div>
    </div>
    ${ture.length ? ture.map((t) => `
      <button class="card" data-trip="${t.id}">
        <div class="row">
          <div class="grow">
            <b>${esc(t.titel || routeName(t.rute) || "Tur")}</b>
            <div class="muted">${fmtDate(t.dato)} · ${fmtKm(t.km)}${t.rute && t.titel ? " · " + esc(routeName(t.rute)) : ""}</div>
            ${t.noter ? `<div class="muted clamp">${esc(t.noter)}</div>` : ""}
          </div>
          <span class="muted" style="font-size:22px">›</span>
        </div>
      </button>`).join("") : `<div class="empty">Ingen ture endnu. Tryk på + for at logge din første tur.</div>`}
    <div class="section-title">Backup</div>
    <div class="card">
      <div class="muted">Ture, pakkelister og egne ruter gemmes kun på denne telefon. Tag en backup en gang imellem.</div>
      <div class="btn-row" style="margin:10px 0 0">
        <button class="btn secondary" id="exportBtn">Backup</button>
        <button class="btn secondary" id="importBtn">Gendan</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    </div>
    <button class="fab" id="fab" aria-label="Ny tur">+</button>
  `;
  $("#fab").onclick = () => editTrip(null);
  $("#exportBtn").onclick = exportData;
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = (e) => importData(e, renderDagbog);
  view.querySelectorAll("[data-trip]").forEach((b) => (b.onclick = () => editTrip(DB.ture.find((t) => t.id === b.dataset.trip))));
}

function editTrip(trip, routeId) {
  const r = routeId ? findRoute(routeId) : null;
  const t = trip || { dato: today(), titel: "", rute: routeId || "", km: r && r.km ? r.km : "", noter: "" };
  openSheet(`
    <h2>${trip ? "Ret tur" : "Ny tur"}</h2>
    <form id="f">
      <label class="field">Dato<input name="dato" type="date" value="${esc(t.dato)}" required></label>
      <label class="field">Titel<input name="titel" placeholder="Fx Søndagstur med Peter" value="${esc(t.titel)}"></label>
      <label class="field">Rute (valgfri)
        <select name="rute"><option value="">– Ingen –</option>${(r && r.egen && !alleRuter().includes(r) ? [r, ...alleRuter()] : alleRuter()).map((x) => `<option value="${x.id}" ${x.id === t.rute ? "selected" : ""}>${esc(x.navn)}</option>`).join("")}</select>
      </label>
      <label class="field">Km kørt<input name="km" type="number" inputmode="decimal" min="0" step="any" value="${esc(t.km)}" required></label>
      <label class="field">Noter<textarea name="noter" placeholder="Vejr, gode stop, hvem kørte med…">${esc(t.noter)}</textarea></label>
      <button class="btn block">Gem tur</button>
      ${trip ? `<button type="button" class="btn danger block" id="del">Slet tur</button>` : ""}
    </form>`, (s) => {
    const f = $("#f", s);
    // Når man vælger en rute, foreslås rutens længde hvis km er tom
    f.rute.onchange = () => { const x = findRoute(f.rute.value); if (x && x.km && !f.km.value) f.km.value = x.km; };
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const d = formData(f);
      const rec = { id: trip ? trip.id : uid(), dato: d.dato, titel: d.titel.trim(), rute: d.rute, km: numOrEmpty(d.km), noter: d.noter.trim() };
      if (!Array.isArray(DB.ture)) DB.ture = [];
      if (trip) Object.assign(trip, rec); else DB.ture.push(rec);
      let msg = "Tur gemt";
      save(); closeSheet(); toast(msg);
      if (location.hash.startsWith("#ture")) renderDagbog();
    };
    const del = $("#del", s);
    if (del) del.onclick = () => {
      if (!confirm("Slet denne tur?")) return;
      DB.ture = DB.ture.filter((x) => x.id !== trip.id);
      save(); closeSheet(); renderDagbog();
    };
  });
  // Ruteoversigten loader geometri asynkront; sikr at km-forslag findes
  if (routeId && !r?.km) loadGeometry().then(() => { const f = $("#f"); const x = findRoute(routeId); if (f && x && !f.km.value) f.km.value = x.km; });
}

/* ---------- Pakkelister ---------- */
function renderPakkelister() {
  setHeader("Pakkelister");
  const lister = pakkelister();
  view.innerHTML = `
    ${segment("pak")}
    ${lister.map((l) => {
      const ok = l.items.filter((i) => i.ok).length;
      return `<a class="card linkcard" href="#ture/pak/${l.id}">
        <div class="row">
          <div class="grow"><b>${esc(l.navn)}</b><div class="muted">${ok} af ${l.items.length} pakket</div>
            <div class="progress"><span style="width:${l.items.length ? (ok / l.items.length) * 100 : 0}%"></span></div>
          </div>
          <span class="muted" style="font-size:22px">›</span>
        </div></a>`;
    }).join("")}
    <div class="btn-row"><button class="btn secondary" id="nyListe">Ny pakkeliste</button></div>
  `;
  $("#nyListe").onclick = () => navnSheet("Ny pakkeliste", "", (navn) => {
    const l = { id: uid(), navn, items: [] };
    DB.pakkelister.push(l); save(); location.hash = "#ture/pak/" + l.id;
  });
}

function renderPakkeliste(id) {
  const l = pakkelister().find((x) => x.id === id);
  if (!l) { location.hash = "#ture/pak"; return; }
  setHeader(l.navn, true);
  const ok = l.items.filter((i) => i.ok).length;
  view.innerHTML = `
    <div class="pad"><div class="muted">${ok} af ${l.items.length} pakket</div>
      <div class="progress"><span style="width:${l.items.length ? (ok / l.items.length) * 100 : 0}%"></span></div></div>
    <div class="card checklist">
      ${l.items.length ? l.items.map((i) => `
        <div class="check ${i.ok ? "done" : ""}" data-item="${i.id}">
          <span class="box">${i.ok ? "✓" : ""}</span>
          <span class="grow">${esc(i.tekst)}</span>
          <button class="x" data-del="${i.id}" aria-label="Fjern ${esc(i.tekst)}">×</button>
        </div>`).join("") : `<div class="muted">Listen er tom. Tilføj ting herunder.</div>`}
    </div>
    <form class="add-row" id="addForm">
      <input name="tekst" placeholder="Tilføj ting…" autocomplete="off" enterkeyhint="done">
      <button class="btn">Tilføj</button>
    </form>
    <div class="btn-row">
      <button class="btn secondary" id="reset">Fjern alle flueben</button>
    </div>
    <div class="btn-row">
      <button class="btn secondary" id="rename">Omdøb</button>
      <button class="btn danger" id="delList">Slet liste</button>
    </div>
  `;
  const rerender = () => { const y = view.scrollTop; renderPakkeliste(id); view.scrollTop = y; };
  view.querySelectorAll("[data-item]").forEach((row) => (row.onclick = (e) => {
    if (e.target.closest(".x")) return;
    const it = l.items.find((i) => i.id === row.dataset.item); it.ok = !it.ok; save(); rerender();
  }));
  view.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { l.items = l.items.filter((i) => i.id !== b.dataset.del); save(); rerender(); }));
  $("#addForm").onsubmit = (e) => {
    e.preventDefault();
    const tekst = e.target.tekst.value.trim(); if (!tekst) return;
    l.items.push({ id: uid(), tekst, ok: false }); save(); rerender();
    const inp = $("#addForm input"); inp && inp.focus();
  };
  $("#reset").onclick = () => { l.items.forEach((i) => (i.ok = false)); save(); rerender(); };
  $("#rename").onclick = () => navnSheet("Omdøb liste", l.navn, (navn) => { l.navn = navn; save(); closeSheet(); renderPakkeliste(id); });
  $("#delList").onclick = () => {
    if (!confirm(`Slet pakkelisten "${l.navn}"?`)) return;
    DB.pakkelister = DB.pakkelister.filter((x) => x.id !== id); save(); location.hash = "#ture/pak";
  };
}

function navnSheet(titel, vaerdi, onSave) {
  openSheet(`
    <h2>${esc(titel)}</h2>
    <form id="f">
      <label class="field">Navn<input name="navn" value="${esc(vaerdi)}" required></label>
      <button class="btn block">Gem</button>
    </form>`, (s) => {
    const inp = $("[name=navn]", s); inp.focus();
    $("#f", s).onsubmit = (e) => { e.preventDefault(); const n = inp.value.trim(); if (n) onSave(n); };
  });
}
