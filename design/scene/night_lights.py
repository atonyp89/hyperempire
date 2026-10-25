"""Build the night "lights" layer for the Empire scene: a full-frame transparent PNG of lit pixels.

Usage: python3 night_lights.py scene-1x.png out.png

At night the app darkens the scene and draws this layer on top, so these pixels stay bright:
lit windows, glowing doorways, the clock face and lamp lanterns. Boxes are native-pixel coords in
design/scene/townhall-pixellab-1x.png (update them if the scene is regenerated).
"""
import colorsys
import sys

from remove_sprites import read_rgba, write_png

WARM = (255, 226, 138)
WARM_DIM = (229, 175, 95)
DOOR = (214, 150, 66)
LANTERN = (255, 241, 194)


def hls(rgb):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in rgb[:3]])
    return h * 360, l, s


# (box x0, y0, x1, y1 exclusive), rule(rgb) -> colour or None
def tavern_windows(p):
    h, l, s = hls(p)
    return WARM if 30 <= h <= 60 and s > 0.5 and l > 0.45 else None


def teal_glass(p):
    h, l, s = hls(p)
    if 175 <= h <= 205 and s > 0.3 and 0.25 <= l <= 0.7:
        return WARM if l > 0.42 else WARM_DIM
    return None


def dark_doorway(p):
    return DOOR if hls(p)[1] < 0.2 else None


def bright(colour):
    return lambda p: colour if hls(p)[1] > 0.45 else None


REGIONS = [
    ((20, 50, 62, 75), tavern_windows),        # Tavern windows (ground floor and gable)
    ((106, 50, 206, 80), teal_glass),          # Townhall wing windows
    ((151, 66, 161, 80), dark_doorway),        # Townhall arched entrance
    ((153, 54, 159, 60), bright(LANTERN)),     # Townhall clock face
    ((270, 62, 286, 76), dark_doorway),        # Exchange doorway
    ((93, 65, 99, 71), bright(LANTERN)),       # lamp by the Townhall
    ((290, 102, 296, 109), bright(LANTERN)),   # lamp by the Exchange
    ((135, 172, 140, 177), bright(LANTERN)),   # lamp at the bottom road
]


def main():
    scene = read_rgba(sys.argv[1])
    h, w = len(scene), len(scene[0])
    out = [[(0, 0, 0, 0)] * w for _ in range(h)]
    lit = 0
    for (x0, y0, x1, y1), rule in REGIONS:
        for y in range(y0, min(y1, h)):
            for x in range(x0, min(x1, w)):
                c = rule(scene[y][x])
                if c:
                    out[y][x] = (*c, 255)
                    lit += 1
    write_png(sys.argv[2], out)
    print(f'wrote {sys.argv[2]}: {lit} lit pixels')


if __name__ == '__main__':
    main()
