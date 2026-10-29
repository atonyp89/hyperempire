"""Build the hero's walkable mask for the Garden scene (src/web/public/empire/garden/walkable.png).

Usage: python3 walkable.py scene-1x.png ../../../src/web/public/empire/garden/walkable.png [preview.png]

The Garden's road is one tan (#c7a56c) with darker specks (#87715b). A pixel is road when it is one of those;
specks are closed (grow 1px, shrink 1px), only the road holding the hero's start (where the road enters at the
bottom, START) is kept, and small blocked patches the road surrounds (HOLE px) are filled so the hero doesn't snag.
The hay bales are the road's tan too, so BLOCK keeps them out. White = walkable, transparent = blocked. Needs Pillow
(`uv run --with pillow python3 walkable.py ...`). Keep START in step with GARDEN_SCENE in
src/web/src/game/buildings/GardenModal.tsx.
"""
import sys
from collections import deque
from PIL import Image

ROAD = {(199, 165, 108), (135, 113, 91)}
START = (128, 200)
HOLE = 30
# Never walkable (x0, y0, x1, y1, inclusive): the two hay bales between the fence and the road.
BLOCK = [(196, 77, 214, 100), (198, 116, 216, 133)]

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
road = [[src.getpixel((x, y)) in ROAD and not any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in BLOCK) for x in range(W)] for y in range(H)]


def grow(m, r):
    return [[any(m[yy][xx] for yy in range(max(0, y - r), min(H, y + r + 1)) for xx in range(max(0, x - r), min(W, x + r + 1))) for x in range(W)] for y in range(H)]


def shrink(m, r):
    return [[all(m[yy][xx] for yy in range(max(0, y - r), min(H, y + r + 1)) for xx in range(max(0, x - r), min(W, x + r + 1))) for x in range(W)] for y in range(H)]


def flood(m, start, value=True):
    seen = [[False] * W for _ in range(H)]
    q = deque([start])
    seen[start[1]][start[0]] = True
    out = []
    while q:
        x, y = q.popleft()
        out.append((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and m[ny][nx] == value:
                seen[ny][nx] = True
                q.append((nx, ny))
    return out


road = shrink(grow(road, 1), 1)
keep = [[False] * W for _ in range(H)]
for x, y in flood(road, START):
    keep[y][x] = True
# Fill small blocked islands inside the road.
done = [[False] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if keep[y][x] or done[y][x]:
            continue
        patch = flood(keep, (x, y), False)
        for px, py in patch:
            done[py][px] = True
        edge = any(px in (0, W - 1) or py in (0, H - 1) for px, py in patch)
        blocked = any(x0 <= px <= x1 and y0 <= py <= y1 for px, py in patch for x0, y0, x1, y1 in BLOCK)
        if len(patch) <= HOLE and not edge and not blocked:
            for px, py in patch:
                keep[py][px] = True

out = Image.new('RGBA', (W, H))
for y in range(H):
    for x in range(W):
        if keep[y][x]:
            out.putpixel((x, y), (255, 255, 255, 255))
out.save(sys.argv[2])
print(f'{sum(map(sum, keep))} walkable px of {W * H}')
if len(sys.argv) > 3:
    prev = src.convert('RGBA')
    tint = Image.new('RGBA', (W, H), (255, 0, 0, 255))
    prev.paste(tint, (0, 0), out.split()[3].point(lambda v: 110 if v else 0))
    prev.resize((W * 3, H * 3), Image.NEAREST).save(sys.argv[3])
