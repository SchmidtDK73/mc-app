"""Laver data/grus.json: lovlige grusveje og skovveje i Midt- og Nordjylland (OpenStreetMap).
Rådata hentes med Overpass i felter (55.9–57.8 N, 8–11 Ø) med denne forespørgsel pr. felt:
  way[highway~"^(unclassified|residential|tertiary|service|road)$"][surface~"^(gravel|fine_gravel|compacted|unpaved|dirt|ground|pebblestone)$"]
  way[highway=track] med motor_vehicle/motorcycle/access = yes|permissive
  – alle uden access/motor_vehicle/motorcycle/vehicle = no|private|agricultural|forestry|delivery|permit(|destination)
og gemmes som {id: {h: highway, s: surface, g: [[lat,lon],...]}}.
Kør: python3 tools/lav_grus.py raa.json data/grus.json
"""
import json,math,sys
w=json.load(open(sys.argv[1]))
ud=[];tot=0;skov=0
for id,x in w.items():
    if x["h"] not in ("unclassified","residential","tertiary","road","track") or x["s"]=="pebblestone": continue
    g=x["g"];cum=[0]
    for a,b in zip(g,g[1:]): cum.append(cum[-1]+math.hypot((b[0]-a[0])*111320,(b[1]-a[1])*111320*math.cos(math.radians(b[0]))))
    m=cum[-1]; tot+=m
    if x["h"]=="track": skov+=m
    if m<300: continue
    k=next(i for i,c in enumerate(cum) if c>=m/2)
    ud.append([round(g[k][0],4),round(g[k][1],4),int(round(m/10)*10),1 if x["h"]=="track" else 0])
ud.sort()
json.dump({"kilde":"OpenStreetMap-bidragydere (ODbL), hentet via Overpass","felter":["lat","lon","meter","skovvej"],"veje":ud},open(sys.argv[2],"w"),separators=(",",":"))
print(len(ud),"ankre",round(tot/1000),"km grus,",round(skov/1000),"km skovvej")
