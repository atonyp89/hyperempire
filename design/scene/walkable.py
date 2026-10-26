"""Build the hero's walkable mask (the roads) from the Empire scene (standard library only).

    python3 walkable.py world-640-1x.png ../../src/web/public/empire/walkable.png [preview.png]

A pixel is road when it is dirt road (#a6936d) or plaza stone (#93948a). The 1px cracks and specks on
the roads are filled by closing the mask (grow 1px, then shrink 1px), and only the road network that
holds the hero's start point is kept, so stone on walls and statues elsewhere doesn't count. Then any
blocked patch under HOLE px that the road surrounds is filled (so the hero doesn't snag on a stray
stone), notches up to about 4px wide along the road edges are closed (grow 2px, shrink 2px), and
strips 2px wide or less are trimmed. The pools and their rims (BLOCK) are never walkable; OPEN strips always
are, for road the colour test misses. The output
is 320x180: white = walkable, transparent = blocked. With a third path it also writes a preview with
the walkable area tinted over the scene.
"""

import sys

sys.path.insert(0, '../sprites')
from sheet import read_rgba, write_png  # noqa: E402

ROAD = {(0xa6, 0x93, 0x6d), (0x93, 0x94, 0x8a)}
START = (316, 100)  # the hero's start on the plaza (src/web/src/game/scene/Hero.tsx)
HOLE = 40
# Never walkable: the two statue pools with their stone rims and fences (x0, y0, x1, y1, inclusive).
BLOCK = [(256, 96, 300, 157), (336, 96, 380, 157)]
# Always walkable (x0, y0, x1, y1, inclusive), for road the colour test misses. Empty now: the small pine that cut
# the bottom road where it meets the east strip was painted out of the scene instead.
OPEN: list[tuple[int, int, int, int]] = []


def grow(m, w, h, keep):
    """One step of dilation (keep=any) or erosion (keep=all) over the 8 neighbours."""
    out = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            ring = [m[y + dy][x + dx] if 0 <= x + dx < w and 0 <= y + dy < h else False
                    for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
            out[y][x] = keep(ring)
    return out


def main():
    src, out = sys.argv[1], sys.argv[2]
    w, h, rows = read_rgba(src)
    m = [[tuple(rows[y][x * 4:x * 4 + 3]) in ROAD for x in range(w)] for y in range(h)]
    m = grow(grow(m, w, h, any), w, h, all)
    keep = [[False] * w for _ in range(h)]
    stack = [START]
    while stack:
        x, y = stack.pop()
        if 0 <= x < w and 0 <= y < h and m[y][x] and not keep[y][x]:
            keep[y][x] = True
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if keep[sy][sx] or seen[sy][sx]:
                continue
            patch, edge, stack = [], False, [(sx, sy)]
            seen[sy][sx] = True
            while stack:
                x, y = stack.pop()
                patch.append((x, y))
                edge = edge or x in (0, w - 1) or y in (0, h - 1)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not keep[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(patch) < HOLE and not edge:
                for x, y in patch:
                    keep[y][x] = True
    for _ in range(2):
        keep = grow(keep, w, h, any)
    for _ in range(2):
        keep = grow(keep, w, h, all)
    keep = grow(grow(keep, w, h, all), w, h, any)
    for x0, y0, x1, y1 in OPEN:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                keep[y][x] = True
    for x0, y0, x1, y1 in BLOCK:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                keep[y][x] = False
    write_png(out, w, h, [b''.join(b'\xff\xff\xff\xff' if keep[y][x] else b'\0\0\0\0' for x in range(w)) for y in range(h)])
    print(f'{out}: {sum(map(sum, keep))} walkable px of {w * h}')
    if len(sys.argv) > 3:
        prev = []
        for y in range(h):
            line = bytearray()
            for x in range(w):
                r, g, b = rows[y][x * 4:x * 4 + 3]
                line += bytes((r // 2 + 120, g // 2 + 40, b // 3, 255)) if keep[y][x] else bytes((r // 3, g // 3, b // 3, 255))
            prev.append(line)
        write_png(sys.argv[3], w, h, prev)


if __name__ == '__main__':
    main()
