"""Tegner app-ikonerne som PNG uden eksterne biblioteker.
Fyldt ikon (iOS runder selv hjørnerne): orange→rød farveovergang med et hvidt MC-hjul.
Tegnes med 4x supersampling for bløde kanter.
Kør: python3 tools/make_icons.py
"""
import math, struct, zlib, os

TOP = (255, 140, 40)      # varm orange
BUND = (214, 48, 49)      # dyb rød
HVID = (255, 255, 255)
SKYGGE = (120, 20, 20)
SS = 4                    # supersampling

def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def farve(x, y):
    """x, y i [0,1). Returnerer (r,g,b)."""
    # diagonal farveovergang
    c = lerp(TOP, BUND, min(1, max(0, (x * 0.35 + y * 0.9) / 1.15)))
    # svag lysglød øverst til venstre
    glod = max(0, 1 - math.hypot(x - 0.25, y - 0.15) / 0.7) * 0.18
    c = lerp(c, HVID, glod)

    dx, dy = x - 0.5, y - 0.5
    r = math.hypot(dx, dy) / 0.5  # 0 i midten, 1 ved kanten
    a = math.atan2(dy, dx)

    def hjul(r, a):
        if 0.58 <= r <= 0.74:          # dæk
            return True
        if 0.47 <= r <= 0.51:          # fælg
            return True
        if r <= 0.15:                  # nav
            return not (r <= 0.06)     # hul i navet
        if 0.15 < r < 0.49:            # 6 eger
            for k in range(6):
                ang = k * math.pi / 3 + math.pi / 6
                diff = abs((a - ang + math.pi) % (2 * math.pi) - math.pi)
                if diff < math.pi / 2 and r * math.sin(diff) < 0.028:
                    return True
        return False

    # blød skygge under hjulet
    rs = math.hypot(dx - 0.012, dy - 0.022) / 0.5
    if hjul(rs, math.atan2(dy - 0.022, dx - 0.012)) and not hjul(r, a):
        c = lerp(c, SKYGGE, 0.35)
    if hjul(r, a):
        c = HVID
    return c

def png(n, path):
    rows = bytearray()
    for y in range(n):
        rows.append(0)
        for x in range(n):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = farve((x + (sx + 0.5) / SS) / n, (y + (sy + 0.5) / SS) / n)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            rows.extend(int(v / (SS * SS) + 0.5) for v in acc)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)

out = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(out, exist_ok=True)
for n in (180, 192, 512):
    png(n, os.path.join(out, f"icon-{n}.png"))
print("ok")
