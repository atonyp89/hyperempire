"""Remap sprite frames onto the Empire scene's palette (standard library only).

    python3 recolor.py PALETTE_SOURCE.png OUT_DIR frame.png [frame.png ...]

Takes every colour used in PALETTE_SOURCE (the scene has ~60) and replaces each opaque sprite pixel
with the nearest one in OKLab, after pulling the sprite's chroma down toward the scene's muted look
(MUTE). Alpha is kept. Used to fit the PixelLab hero into the town: the raw exports stay in
src/web/public/empire/heroes/knight/raw/.
"""

import os
import sys

from sheet import read_rgba, write_png

MUTE = 0.45  # keep this share of a cool (blue) colour's chroma before matching; warm accents keep theirs
# Colours the scene lacks: a muted skin ramp (faces would turn grey) and two lighter steps on the
# slate-blue roof ramp (light blues would fall onto the teal water).
EXTRA = [(0xe3, 0xbc, 0x98), (0xc0, 0x8f, 0x72), (0x8a, 0x5c, 0x4e), (0x5a, 0x77, 0x8c), (0x7b, 0x93, 0xa6)]


def oklab(rgb):
    lin = [((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92 for c in rgb]
    r, g, b = lin
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def palette(path):
    w, h, rows = read_rgba(path)
    cols = {tuple(r[x * 4:x * 4 + 3]) for r in rows for x in range(w) if r[x * 4 + 3] > 128}
    return [(c, oklab(c)) for c in cols | set(EXTRA)]


def nearest(rgb, pal, cache):
    if rgb not in cache:
        L, a, b = oklab(rgb)
        if b < 0:
            a, b = a * MUTE, b * MUTE
        cache[rgb] = min(pal, key=lambda p: (p[1][0] - L) ** 2 + (p[1][1] - a) ** 2 + (p[1][2] - b) ** 2)[0]
    return cache[rgb]


def main():
    pal, out, cache = palette(sys.argv[1]), sys.argv[2], {}
    os.makedirs(out, exist_ok=True)
    for path in sys.argv[3:]:
        w, h, rows = read_rgba(path)
        for r in rows:
            for x in range(w):
                if r[x * 4 + 3]:
                    r[x * 4:x * 4 + 3] = bytes(nearest(tuple(r[x * 4:x * 4 + 3]), pal, cache))
        write_png(os.path.join(out, os.path.basename(path)), w, h, rows)
    print(f'{len(sys.argv) - 3} frames -> {out} ({len(pal)} palette colours, {len(set(cache.values()))} used)')


if __name__ == '__main__':
    main()
