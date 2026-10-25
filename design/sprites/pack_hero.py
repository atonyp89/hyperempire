"""Pack a hero's idle and walk sheets: 4 frames x 8 directions of 32x32 each (standard library only).

    python3 pack_hero.py HERO_DIR

Reads, under HERO_DIR:
  rotations/<dir>.png    PixelLab turnaround, 32x32
  idle-south/<0-3>.png   optional hand-made south idle, 32x32 (otherwise it's made like the others)
  walk/<dir>/<0-3>.png   PixelLab skeleton walk frames (they come back on a larger canvas)
and writes idle.png and walk.png. Every direction is shifted so its standing feet land on row FEET and
its body is centred on column CENTRE, the anchor Hero.tsx uses, so the hero neither floats nor jumps
when it turns, starts or stops. PixelLab draws the side views a pixel higher than the front ones.

The idle (for south too unless idle-south/ exists) is the rotation sprite, then everything above the legs
(the bottom 3 rows) 1px lower: 2 frames each. Where the walk comes out taller than the standing pose
(the side views: the skeleton straightens the legs), its body is lowered to the standing height.
Row order matches DIRS in src/web/src/game/scene/Hero.tsx.
"""

import os
import sys

from sheet import read_rgba, write_png

DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
OUT = 32
FEET = 27
CENTRE = 16


def bounds(w, h, rows):
    ys = [y for y in range(h) if any(rows[y][x * 4 + 3] > 128 for x in range(w))]
    xs = [x for x in range(w) if any(rows[y][x * 4 + 3] > 128 for y in range(h))]
    return min(xs), max(xs), min(ys), max(ys)


def crop(w, h, rows, ox, oy):
    """32x32 window of the image whose top-left is (ox, oy); outside the image is transparent."""
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


def dip(rows, by=1, legs=None):
    """The same pose with everything above the legs `by` px lower, the legs left where they are.

    `legs` is the first leg row; by default the bottom 3 rows of the figure."""
    if legs is None:
        legs = max(y for y in range(OUT) if any(rows[y][x * 4 + 3] for x in range(OUT))) - 2
    out = [bytearray(OUT * 4) for _ in range(OUT)]
    for y in range(legs - by):
        out[y + by][:] = rows[y]
    for y in range(legs, OUT):
        for x in range(OUT):
            if rows[y][x * 4 + 3]:
                out[y][x * 4:x * 4 + 4] = rows[y][x * 4:x * 4 + 4]
    return out


def top(rows):
    return min(y for y in range(OUT) if any(rows[y][x * 4 + 3] > 128 for x in range(OUT)))


def anchored(frames, ref):
    """Crop every frame by the same offset, the one that puts `ref`'s feet on FEET and centre on CENTRE."""
    x0, x1, _, y1 = bounds(*ref)
    ox, oy = round((x0 + x1) / 2 - CENTRE), y1 - FEET
    return [crop(w, h, rows, ox, oy) for w, h, rows in frames]


def main():
    hero = sys.argv[1]
    idle, walk = [], []
    for d in DIRS:
        rot = read_rgba(os.path.join(hero, 'rotations', f'{d}.png'))
        if d == 'south' and os.path.isdir(os.path.join(hero, 'idle-south')):
            src = [read_rgba(os.path.join(hero, 'idle-south', f'{i}.png')) for i in range(4)]
            idle_frames = anchored(src, src[0])
        else:
            [still] = anchored([rot], rot)
            idle_frames = [still, still, dip(still), dip(still)]
        steps = [read_rgba(os.path.join(hero, 'walk', d, f'{i}.png')) for i in range(4)]
        walk_frames = anchored(steps, steps[0])
        # The skeleton walk straightens the legs in the side views, so the body rides higher than when
        # standing: lower everything above the legs by the difference, so walking keeps the standing height.
        taller = top(idle_frames[0]) - top(walk_frames[0])
        if taller > 0:
            walk_frames = [dip(f, taller, FEET - 2) for f in walk_frames]
        for y in range(OUT):
            idle.append(b''.join(f[y] for f in idle_frames))
            walk.append(b''.join(f[y] for f in walk_frames))
    write_png(os.path.join(hero, 'idle.png'), OUT * 4, OUT * len(DIRS), idle)
    write_png(os.path.join(hero, 'walk.png'), OUT * 4, OUT * len(DIRS), walk)
    print(f'{hero}: idle.png, walk.png (feet on row {FEET}, centre column {CENTRE})')


if __name__ == '__main__':
    main()
