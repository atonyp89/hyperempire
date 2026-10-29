"""Build the Garden screen's field (src/web/public/empire/garden/field.png): a fenced lawn with a 4x4 grid of
tilled plots, cut from the town's own Garden so it matches the scene.

Usage: python3 field.py ../../../src/web/public/empire/town-base.png ../../../src/web/public/empire/garden/field.png

- Plots: each is the town's furrowed plot (x 6-38, y 124-170) shrunk to PLOT x PLOT by keeping its edges and
  corners and dropping middle rows and columns, so the ragged outline survives.
- Fence: one 8 px repeat of the town's top fence (x 8-15, y 113-123) along the top and bottom, and of its left
  fence (x 0-3, y 123-130) down both sides.
- Lawn: the plain grass colour with the scene's lighter and darker blades, placed from a fixed seed.

The web app's Garden screen reads the same layout (GARDEN_FIELD in src/web/src/game/buildings/GardenField.tsx):
keep the numbers below in step with it. Needs Pillow (`uv run --with pillow python3 field.py ...`).
"""
import random
import sys
from PIL import Image

PLOT, GAP, COLS, ROWS = 24, 6, 4, 4
SIDE, TOP = 4, 10            # fence thickness: sides, top and bottom
MARGIN = 6                   # lawn between the fence and the plots
GRID = COLS * PLOT + (COLS - 1) * GAP
W = SIDE + MARGIN + GRID + MARGIN + SIDE
H = TOP + MARGIN + GRID + MARGIN + TOP
ORIGIN = (SIDE + MARGIN, TOP + MARGIN)

src = Image.open(sys.argv[1]).convert('RGBA')


def shrink(img, w, h, keep=6):
    """Resize by keeping `keep` px at each edge and as many middle rows/columns (from the start) as fit."""
    def axis(n, size):
        return list(range(keep)) + list(range(keep, keep + size - 2 * keep)) + list(range(n - keep, n))
    xs, ys = axis(img.width, w), axis(img.height, h)
    out = Image.new('RGBA', (w, h))
    for oy, sy in enumerate(ys):
        for ox, sx in enumerate(xs):
            out.putpixel((ox, oy), img.getpixel((sx, sy)))
    return out


plot = shrink(src.crop((6, 124, 39, 171)), PLOT, PLOT)
fence_h = src.crop((8, 113, 16, 124))         # 8 x 11: posts and rails, with the shadow row under them
fence_v = src.crop((0, 123, 4, 131))          # 4 x 8: the side fence

grass = (106, 137, 84, 255)
blades = [(92, 122, 74, 255), (120, 150, 92, 255), (80, 108, 66, 255)]
field = Image.new('RGBA', (W, H), grass)
rnd = random.Random(7)
for _ in range(W * H // 18):
    field.putpixel((rnd.randrange(W), rnd.randrange(H)), rnd.choice(blades))

for r in range(ROWS):
    for c in range(COLS):
        field.alpha_composite(plot, (ORIGIN[0] + c * (PLOT + GAP), ORIGIN[1] + r * (PLOT + GAP)))
for y in range(0, H, 8):
    field.alpha_composite(fence_v, (0, y))
    field.alpha_composite(fence_v.transpose(Image.FLIP_LEFT_RIGHT), (W - SIDE, y))
for x in range(0, W, 8):
    field.alpha_composite(fence_h, (x, 0))
    field.alpha_composite(fence_h, (x, H - fence_h.height))
field.save(sys.argv[2])
print(f'{W}x{H}, plots {PLOT}px every {PLOT + GAP}px from {ORIGIN}')
