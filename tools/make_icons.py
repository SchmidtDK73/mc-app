"""Tegner app-ikonerne (hjul på mørk baggrund) som PNG uden eksterne biblioteker.
Kør: python3 tools/make_icons.py
"""
import math, struct, zlib, os

BG = (27, 31, 36)
ORANGE = (232, 89, 12)
LIGHT = (241, 243, 245)

def pixel(x, y, n):
    c = n / 2
    dx, dy = (x + 0.5 - c) / c, (y + 0.5 - c) / c
    r = math.hypot(dx, dy)
    if 0.56 <= r <= 0.74:       # dæk
        return ORANGE
    if 0.50 <= r < 0.56:        # fælg
        return LIGHT
    if r < 0.12:                # nav
        return ORANGE
    if r < 0.50:                # eger
        a = math.atan2(dy, dx)
        for k in range(5):
            ang = k * 2 * math.pi / 5 - math.pi / 2
            diff = abs((a - ang + math.pi) % (2 * math.pi) - math.pi)
            if r * math.sin(diff) < 0.035 and diff < math.pi / 2:
                return LIGHT
    return BG

def png(n, path):
    rows = b"".join(b"\x00" + bytes(v for x in range(n) for v in pixel(x, y, n)) for y in range(n))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)

out = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(out, exist_ok=True)
for n in (180, 192, 512):
    png(n, os.path.join(out, f"icon-{n}.png"))
print("ok")
