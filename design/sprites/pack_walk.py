"""Pack a hero's walk cycle into one sheet: 4 frames x 8 directions of 32x32 (standard library only).

    python3 pack_walk.py HERO_DIR

Reads HERO_DIR/walk/<dir>/<0-3>.png (PixelLab skeleton walk frames, which come back on a larger
canvas) and HERO_DIR/rotations/<dir>.png (32x32), and writes HERO_DIR/walk.png. Each direction is
cropped so its frame 0 lines up with that direction's rotation sprite (same feet row, same centre),
so walking and standing share one anchor and the hero does not jump when it starts or stops.
Row order matches DIRS in src/web/src/components/Hero.tsx.
"""

import os
import sys

from sheet import read_rgba, write_png

DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
OUT = 32


def bounds(w, h, rows):
    ys = [y for y in range(h) if any(rows[y][x * 4 + 3] > 128 for x in range(w))]
    xs = [x for x in range(w) if any(rows[y][x * 4 + 3] > 128 for y in range(h))]
    return min(xs), max(xs), min(ys), max(ys)


def crop(w, h, rows, ox, oy):
    out = [bytearray(OUT * 4) for _ in range(OUT)]
    for y in range(OUT):
        sy = y + oy
        if not 0 <= sy < h:
            continue
        for x in range(OUT):
            sx = x + ox
            if 0 <= sx < w:
                out[y][x * 4:x * 4 + 4] = rows[sy][sx * 4:sx * 4 + 4]
    return out


def main():
    hero = sys.argv[1]
    sheet = []
    for d in DIRS:
        rx0, rx1, _, ry1 = bounds(*read_rgba(os.path.join(hero, 'rotations', f'{d}.png')))
        frames = [read_rgba(os.path.join(hero, 'walk', d, f'{i}.png')) for i in range(4)]
        fx0, fx1, _, fy1 = bounds(*frames[0])
        ox = round((fx0 + fx1) / 2 - (rx0 + rx1) / 2)
        oy = fy1 - ry1
        cropped = [crop(w, h, rows, ox, oy) for w, h, rows in frames]
        for y in range(OUT):
            sheet.append(b''.join(f[y] for f in cropped))
        print(d, 'offset', ox, oy)
    write_png(os.path.join(hero, 'walk.png'), OUT * 4, OUT * len(DIRS), sheet)


if __name__ == '__main__':
    main()
