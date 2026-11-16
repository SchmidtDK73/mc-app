"""Henter lovlige grus- og skovveje i Midt- og Nordjylland fra OpenStreetMap (Overpass)
og gemmer rådata som {id: {h: highway, s: surface, g: [[lat,lon],...]}}.
Området deles i felter, og hvert felt prøves flere gange, fordi Overpass ofte er travl.
Afslutter med fejlkode, hvis et felt ikke kunne hentes – så bliver den gamle data/grus.json ikke rørt.
Kør: python3 tools/hent_grus.py raa.json
"""
import json, sys, time, urllib.parse, urllib.request

SERVERE = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
UA = "mc-app-grus/1.0 (+https://github.com/SchmidtDK73/mc-app)"
IKKE = ('["access"!~"^(no|private|agricultural|forestry|delivery|permit)$"]'
        '["motor_vehicle"!~"^(no|private|agricultural|forestry|delivery|destination|permit)$"]'
        '["motorcycle"!~"^(no|private|agricultural|forestry)$"]'
        '["vehicle"!~"^(no|private|agricultural|forestry)$"]')


def forespoergsel(bb):
    return f"""[out:json][timeout:90];(
way["highway"~"^(unclassified|residential|tertiary|service|road)$"]["surface"~"^(gravel|fine_gravel|compacted|unpaved|dirt|ground|pebblestone)$"]{IKKE}["service"!~"^(driveway|parking_aisle)$"]{bb};
way["highway"="track"]["motor_vehicle"~"^(yes|permissive)$"]{IKKE}{bb};
way["highway"="track"]["motorcycle"~"^(yes|permissive)$"]{IKKE}{bb};
way["highway"="track"]["access"~"^(yes|permissive)$"]{IKKE}{bb};
);out tags geom qt;"""


def felter():
    la = 55.9
    while la < 57.8 - 1e-9:
        for lo in (8.0, 9.0, 10.0):
            yield (round(la, 2), lo, round(min(la + 0.4, 57.8), 2), lo + 1.0)
        la += 0.4


def hent(bb):
    data = urllib.parse.urlencode({"data": forespoergsel(bb)}).encode()
    for forsoeg in range(12):
        server = SERVERE[forsoeg % len(SERVERE)]
        try:
            req = urllib.request.Request(server, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["elements"]
        except Exception as e:
            print(f"  {bb} forsøg {forsoeg + 1} ({server.split('/')[2]}): {e}", flush=True)
            time.sleep(10 + 10 * forsoeg)
    raise SystemExit(f"Kunne ikke hente felt {bb} – stopper uden at ændre noget")


veje = {}
for f in felter():
    bb = "(" + ",".join(str(v) for v in f) + ")"
    el = hent(bb)
    for w in el:
        if "geometry" in w:
            veje[w["id"]] = {"h": w["tags"]["highway"], "s": w["tags"].get("surface", ""),
                             "g": [[round(p["lat"], 5), round(p["lon"], 5)] for p in w["geometry"]]}
    print(f"{bb}: {len(el)} veje (i alt {len(veje)})", flush=True)
    time.sleep(3)

json.dump(veje, open(sys.argv[1], "w"))
