# MC-app

Motorcykel-webapp (PWA) til iPhone. Ren HTML/CSS/JS – ingen build-trin.

## Kør lokalt

```bash
python3 -m http.server 8790
```

Åbn http://localhost:8790.

## Læg på iPhone

Service worker og "Føj til hjemmeskærm" kræver HTTPS. Læg mappen på en statisk host
(fx GitHub Pages, Netlify eller Cloudflare Pages), åbn adressen i Safari og vælg
Del → "Føj til hjemmeskærm".

## Struktur

- `index.html`, `styles.css`, `app.js` – appskal, Ruter, datalagring og backup
- `vejr.js` – "MC-vejr i dag?" (ja/måske/nej) med prognose fra Open-Meteo
- `ture.js` – kørselsdagbog og pakkelister
- `ruteplan.js` – "Lav min egen rute": rundtur ud fra start og ønsket længde (OSRM)
- `data/routes.js` – rutebeskrivelser, stop og kilder
- `data/geometry.json` – vejforløb (beregnet med OSRM på OpenStreetMap-data)
- `undervejs.js` – "Find undervejs" (Geoapify Places API) og "Tilføj som stop"
- `config.js` – Geoapify API-nøgle (låst til appens adresse hos Geoapify)
- `sw.js` – offline-cache (app-filer ved installation, kortfliser efterhånden som de vises)
- `vendor/` – Leaflet 1.9.4
- `tools/make_icons.py` – genererer ikonerne i `icons/`

Ture, pakkelister og egne ruter gemmes i `localStorage` på telefonen. Brug Backup/Gendan nederst under Ture for at flytte eller sikre data.

Når app-filer ændres, så hæv `VERSION` i `sw.js`.
