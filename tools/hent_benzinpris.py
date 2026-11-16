"""Henter OK's benzinpriser (offentligt API, kræves af prismærkningsbekendtgørelsen fra 2026)
og gemmer listeprisen for 95 og 100 oktan i data/benzinpris.json.
Listeprisen = den pris flest stationer har (typetallet). Stationer med lokal rabat trækker ikke.
Kør: python3 tools/hent_benzinpris.py data/benzinpris.json
"""
import collections, datetime, json, sys, urllib.request

URL = "https://mobility-prices.ok.dk/api/v1/fuel-prices"
PRODUKTER = {"95": "Blyfri 95", "100": "Oktan 100"}

req = urllib.request.Request(URL, headers={"Accept": "application/json", "User-Agent": "mc-app/1.0 (+https://github.com/SchmidtDK73/mc-app)"})
with urllib.request.urlopen(req, timeout=60) as r:
    items = json.load(r)["items"]

priser = {}
for kode, navn in PRODUKTER.items():
    c = collections.Counter(p["price"] for s in items for p in s.get("prices", []) if p.get("product_name") == navn)
    if sum(c.values()) < 50:
        raise SystemExit(f"For få priser på {navn} ({sum(c.values())}) – beholder den gamle fil")
    pris = c.most_common(1)[0][0]
    if not 5 < pris < 50:
        raise SystemExit(f"Mærkelig pris på {navn}: {pris} – beholder den gamle fil")
    priser[kode] = pris

ud = {"kilde": "OK (listepris, flest stationer)", "dato": datetime.date.today().isoformat(), "priser": priser}
try:
    gammel = json.load(open(sys.argv[1]))
    if gammel.get("priser") == priser:
        print("Uændret:", priser); sys.exit(0)  # undgå et commit hver dag kun for datoens skyld
except (FileNotFoundError, ValueError):
    pass
json.dump(ud, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print("Ny pris:", ud)
