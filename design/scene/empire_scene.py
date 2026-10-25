"""HyperEmpire main scene: a top-down pixel-art town around the Townhall.

Usage: python3 empire_scene.py [out.png] [scale]

Style: muted, earthy top-down RPG town (olive grass, dirt roads, big outlined hip roofs over short
front walls, stone plaza with statue pools, dark round trees and pines, striped crop fields).
Draws 320x180 pixels and scales up (default x4 = 1280x720). Standard library only; uses macOS
`sips` for the PNG.
"""
import os
import random
import subprocess
import sys

W, H = 320, 180
rng = random.Random(5)
img = [[(0, 0, 0)] * W for _ in range(H)]


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


C = {k: hexc(v) for k, v in {
    'ink': '#1E1A1C',
    # ground
    'g0': '#5F7B3D', 'g1': '#56713A', 'g2': '#6C8A46', 'g3': '#4A6432', 'gs': '#46602F',
    'd0': '#A3855A', 'd1': '#957750', 'd2': '#B49770', 'd3': '#7C6243',
    'st0': '#9E9A91', 'st1': '#B1ADA4', 'st2': '#7A766F', 'st3': '#5E5B56',
    'soil0': '#6E5236', 'soil1': '#5A422B', 'crop0': '#5E8A3C', 'crop1': '#46702F', 'crop2': '#C9A646',
    # water
    'w0': '#3F6E8C', 'w1': '#5285A3', 'w2': '#2D5671', 'w3': '#7AA9C2',
    # roofs
    'r0': '#B0533F', 'r1': '#954235', 'r2': '#79342C', 'r3': '#5A2622',
    's0': '#6E7F99', 's1': '#5A6A84', 's2': '#47556C', 's3': '#343F52',
    'b0': '#9A7650', 'b1': '#7F603F', 'b2': '#654B31', 'b3': '#4A3624',
    # walls
    'wd0': '#9C7550', 'wd1': '#82603F', 'wd2': '#664A30',
    'sw0': '#B7B1A4', 'sw1': '#9B9588', 'sw2': '#7C776C',
    'pl0': '#D8CCAE', 'pl1': '#BFB291',
    'win0': '#2A3445', 'win1': '#56739A', 'warm0': '#F2C46A', 'warm1': '#C98E3E',
    'door0': '#5C3F28', 'door1': '#432D1C',
    # trees
    't0': '#4E7E44', 't1': '#3C6638', 't2': '#2C4F2E', 't3': '#1F3A24', 'trunk': '#5A4030',
    # accents
    'mar0': '#E7E2D6', 'mar1': '#B9B3A6', 'gold0': '#F3CF6A', 'gold1': '#C9982F', 'gold2': '#8F6A1F',
    'teal0': '#6FD9C2', 'teal1': '#2FB79C', 'teal2': '#1E7D6B',
    'flower0': '#D96C7A', 'flower1': '#E8C25A', 'flower2': '#9E86D6', 'flower3': '#E9E4D8',
    'smoke': '#C9CDD2', 'lampglow': '#F6DA8C',
}.items()}


def px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        img[y][x] = C[c] if isinstance(c, str) else c


def get(x, y):
    return img[y][x] if 0 <= x < W and 0 <= y < H else None


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            px(x, y, c)


def hline(x0, x1, y, c):
    for x in range(x0, x1):
        px(x, y, c)


def vline(x, y0, y1, c):
    for y in range(y0, y1):
        px(x, y, c)


def frame(x0, y0, x1, y1, c='ink'):
    hline(x0, x1, y0, c)
    hline(x0, x1, y1 - 1, c)
    vline(x0, y0, y1, c)
    vline(x1 - 1, y0, y1, c)


def ellipse(cx, cy, rx, ry, c):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2 <= 1.0:
                px(x, y, c)


GRASS = None


def shade(x0, y0, x1, y1):
    """Cast shadow on grass only."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if get(x, y) in GRASS:
                px(x, y, 'gs')


def soft_shade(cx, cy, rx, ry):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and get(x, y) in GRASS:
                px(x, y, 'gs')


# ---------------------------------------------------------------- ground

def grass():
    global GRASS
    for y in range(H):
        for x in range(W):
            n = (x * 17 + y * 29 + (x * y) % 13) % 10
            px(x, y, 'g0' if n < 6 else 'g1')
    for _ in range(700):
        x, y = rng.randrange(W), rng.randrange(H)
        px(x, y, 'g3')
        px(x + 1, y - 1, 'g3')
    for _ in range(380):
        px(rng.randrange(W), rng.randrange(H), 'g2')
    GRASS = {C['g0'], C['g1'], C['g2'], C['g3']}


def road(x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            n = (x * 7 + y * 13) % 9
            px(x, y, 'd0' if n < 6 else 'd1')
    for _ in range((x1 - x0) * (y1 - y0) // 14):
        px(rng.randrange(x0, x1), rng.randrange(y0, y1), 'd2' if rng.random() < 0.6 else 'd3')
    # ragged grass edges
    for x in range(x0, x1):
        if rng.random() < 0.35:
            px(x, y0, 'g1')
        if rng.random() < 0.35:
            px(x, y1 - 1, 'g1')
        px(x, y1, 'd3') if get(x, y1) in GRASS else None
    for y in range(y0, y1):
        if rng.random() < 0.35:
            px(x0, y, 'g1')
        if rng.random() < 0.35:
            px(x1 - 1, y, 'g1')


def plaza(x0, y0, x1, y1):
    rect(x0, y0, x1, y1, 'st0')
    for y in range(y0, y1):
        if (y - y0) % 4 == 3:
            hline(x0, x1, y, 'st2')
        else:
            off = ((y - y0) // 4) % 2 * 3
            for x in range(x0 + off, x1, 6):
                px(x, y, 'st2')
        if (y - y0) % 4 == 0:
            for x in range(x0 + 1, x1, 6):
                px(x, y, 'st1')
    frame(x0, y0, x1, y1, 'st3')


def pool(x0, y0, x1, y1):
    shade(x0 + 2, y1, x1 + 2, y1 + 2)
    rect(x0, y0, x1, y1, 'st1')
    frame(x0, y0, x1, y1, 'ink')
    hline(x0 + 1, x1 - 1, y1 - 2, 'st2')
    rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, 'w0')
    frame(x0 + 2, y0 + 2, x1 - 2, y1 - 2, 'st3')
    hline(x0 + 3, x1 - 3, y0 + 3, 'w2')
    for _ in range((x1 - x0) * (y1 - y0) // 30):
        x, y = rng.randrange(x0 + 4, x1 - 6), rng.randrange(y0 + 5, y1 - 4)
        hline(x, x + 3, y, 'w1')
    for (sx, sy) in ((x0 + 8, y0 + 7), (x1 - 9, y0 + 7), (x0 + 8, y1 - 10), (x1 - 9, y1 - 10)):
        statue(sx, sy)


def statue(x, y):
    rect(x - 2, y + 3, x + 3, y + 5, 'mar1')
    frame(x - 2, y + 3, x + 3, y + 5, 'st3')
    ellipse(x, y + 1, 1.6, 2.2, 'mar0')
    ellipse(x, y - 2, 1.2, 1.2, 'mar0')
    px(x + 1, y + 1, 'mar1')
    px(x - 2, y, 'mar0'); px(x + 2, y - 1, 'mar0')


def field(x0, y0, x1, y1):
    rect(x0, y0, x1, y1, 'soil0')
    frame(x0, y0, x1, y1, 'soil1')
    for x in range(x0 + 2, x1 - 1, 4):
        vline(x, y0 + 1, y1 - 1, 'soil1')
        for y in range(y0 + 2, y1 - 2, 3):
            px(x + 1, y, 'crop0' if (x + y) % 2 else 'crop1')
            px(x + 1, y + 1, 'crop1')
            if (x * 3 + y) % 11 == 0:
                px(x + 1, y, 'crop2')


def fence_h(x0, x1, y):
    for x in range(x0, x1):
        px(x, y, 'wd1')
        px(x, y + 1, 'wd2')
    for x in range(x0, x1 + 1, 4):
        rect(x, y - 2, x + 1, y + 2, 'wd2')
        px(x, y - 2, 'wd0')


def fence_v(x, y0, y1):
    for y in range(y0, y1):
        px(x, y, 'wd1')
        px(x + 1, y, 'wd2')
    for y in range(y0, y1 + 1, 4):
        px(x, y, 'wd0')


# ---------------------------------------------------------------- vegetation

def round_tree(cx, cy, r):
    soft_shade(cx + 2, cy + r * 0.8, r * 1.05, r * 0.45)
    rect(cx - 1, cy + r - 2, cx + 1, cy + r + 2, 'trunk')
    ellipse(cx, cy, r + 0.8, r * 0.95 + 0.8, 'ink')
    ellipse(cx, cy, r, r * 0.95, 't2')
    ellipse(cx - 0.8, cy - 0.8, r - 1.5, r * 0.95 - 1.6, 't1')
    ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.45, r * 0.38, 't0')
    for _ in range(int(r * 2.5)):
        a, b = rng.uniform(-r + 1.5, r - 1.5), rng.uniform(-r + 1.5, r - 1.5)
        if a * a + b * b < (r - 1.5) ** 2:
            px(int(cx + a), int(cy + b), 't3' if b > 0 else 't0')


def pine(cx, base, h):
    soft_shade(cx + 2, base, h * 0.35, h * 0.14)
    vline(cx, base - 2, base + 1, 'trunk')
    for i in range(h):
        y = base - 2 - i
        tier = i % (h // 3 + 1)
        half = int((h - i) * 0.42) - tier // 2 + 1
        if half < 0:
            continue
        hline(cx - half, cx + half + 1, y, 't2')
        hline(cx - half, cx, y, 't1')
        if half > 1:
            px(cx - half + 1, y, 't0')
        px(cx - half - 1, y, 'ink')
        px(cx + half + 1, y, 'ink')
    px(cx, base - 2 - h, 'ink')


def hedge(x0, y0, x1, y1):
    shade(x0 + 1, y1, x1 + 1, y1 + 2)
    rect(x0, y0, x1, y1, 't1')
    frame(x0, y0, x1, y1, 't3')
    for x in range(x0 + 1, x1 - 1, 3):
        px(x, y0 + 1, 't0')
        px(x + 1, y1 - 2, 't2')


def flowers(x0, y0, x1, y1, n):
    for _ in range(n):
        x, y = rng.randrange(x0, x1), rng.randrange(y0, y1)
        if get(x, y) in GRASS:
            px(x, y, rng.choice(('flower0', 'flower1', 'flower2', 'flower3')))


# ---------------------------------------------------------------- buildings

def hip_roof(x0, y0, x1, y1, ramp):
    """Hip roof seen from above: back slope strip, front slope with shingle rows, darker hips at the ends."""
    l, m, d, dd = ramp
    shade(x1, y0 + 3, x1 + 3, y1 + 2)
    h = y1 - y0
    ridge = y0 + max(2, h // 3)
    hip = min((x1 - x0) // 4, h)
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = l if y < ridge else m
            if y >= ridge and (y - ridge) % 3 == 2:
                c = d
            elif y >= ridge and (x + (y - ridge) // 3 * 2) % 6 == 0:
                c = d
            # hips: triangles at both ends
            dl = x - x0
            dr = x1 - 1 - x
            yy = y - y0
            if dl < hip and dl < yy * hip / h + (hip if y >= ridge else 0) * 0 and dl < hip * (1 - abs(yy - h / 2) / (h / 2)) + 1:
                c = d
            if dr < hip and dr < hip * (1 - abs(yy - h / 2) / (h / 2)) + 1:
                c = dd
            px(x, y, c)
    hline(x0 + hip // 2, x1 - hip // 2, ridge, d)
    hline(x0 + hip // 2, x1 - hip // 2, ridge - 1, l)
    frame(x0, y0, x1, y1, 'ink')
    hline(x0 + 1, x1 - 1, y1 - 2, dd)


def front_wall(x0, x1, y, h, kind='wood'):
    if kind == 'wood':
        for yy in range(y, y + h):
            hline(x0, x1, yy, 'wd0' if (yy - y) % 3 else 'wd1')
        for x in range(x0 + 4, x1, 8):
            vline(x, y, y + h, 'wd2')
    elif kind == 'stone':
        rect(x0, y, x1, y + h, 'sw1')
        for yy in range(y, y + h):
            if (yy - y) % 3 == 2:
                hline(x0, x1, yy, 'sw2')
            else:
                for x in range(x0 + ((yy - y) // 3 % 2) * 3, x1, 6):
                    px(x, yy, 'sw2')
            if (yy - y) % 3 == 0:
                for x in range(x0 + 1, x1, 6):
                    px(x, yy, 'sw0')
    elif kind == 'plaster':
        rect(x0, y, x1, y + h, 'pl0')
        for x in range(x0, x1, 9):
            vline(x, y, y + h, 'wd2')
        hline(x0, x1, y + h // 2, 'wd2')
    frame(x0, y - 1, x1, y + h + 1, 'ink')
    shade(x0 + 2, y + h + 1, x1 + 3, y + h + 3)


def win(x, y, warm=False, w=4, h=4):
    rect(x, y, x + w, y + h, 'ink')
    rect(x + 1, y + 1, x + w - 1, y + h - 1, 'warm0' if warm else 'win0')
    px(x + 1, y + 1, 'warm1' if warm else 'win1')


def door(x, y, w=6, h=7, arch=False):
    rect(x, y, x + w, y + h, 'ink')
    rect(x + 1, y + 1, x + w - 1, y + h, 'door0')
    vline(x + w // 2, y + 1, y + h, 'door1')
    if arch:
        hline(x + 1, x + w - 1, y, 'st1')
        px(x, y, 'st1'); px(x + w - 1, y, 'st1')


def chimney(x, y, smoke=True):
    rect(x, y, x + 4, y + 6, 'sw1')
    frame(x, y, x + 4, y + 6, 'ink')
    hline(x + 1, x + 3, y + 1, 'sw0')
    if smoke:
        for i, (dx, dy, r) in enumerate(((2, -3, 1.6), (3, -7, 2), (1, -11, 2.2))):
            ellipse(x + dx, y + dy, r, r * 0.9, 'smoke')


def townhall():
    # side wings (slate) and main hall (red), with a cross gable over the entrance
    shade(104, 74, 220, 80)
    hip_roof(102, 30, 152, 62, ('s0', 's1', 's2', 's3'))
    hip_roof(168, 30, 218, 62, ('s0', 's1', 's2', 's3'))
    front_wall(104, 150, 62, 12, 'stone')
    front_wall(170, 216, 62, 12, 'stone')
    hip_roof(126, 14, 194, 56, ('r0', 'r1', 'r2', 'r3'))
    front_wall(130, 190, 56, 14, 'stone')
    # cross gable over the entrance: narrows to a point at the top, light left slope, dark right slope
    cx, gy0, gy1 = 160, 18, 60
    for y in range(gy0, gy1):
        half = 3 + int((y - gy0) * 9 / (gy1 - gy0))
        for x in range(cx - half, cx + half):
            left = x < cx
            c = 'r0' if left else 'r2'
            if (y - gy0) % 3 == 2:
                c = 'r1' if left else 'r3'
            px(x, y, c)
        px(cx - half - 1, y, 'ink')
        px(cx + half, y, 'ink')
    hline(cx - 3, cx + 3, gy0, 'ink')
    vline(cx, gy0, gy1, 'r3')
    # clock gable face and arched entrance
    rect(150, 56, 170, 72, 'sw0')
    frame(150, 56, 170, 72, 'ink')
    ellipse(160, 61, 3.6, 3.6, 'ink')
    ellipse(160, 61, 2.8, 2.8, 'mar0')
    px(160, 60, 'ink'); px(161, 61, 'ink')
    rect(155, 65, 165, 72, 'ink')
    rect(156, 66, 164, 72, 'door0')
    hline(156, 164, 65, 'sw0')
    vline(160, 66, 72, 'door1')
    # windows along the stone fronts
    for x in (108, 116, 124, 136, 142, 176, 182, 196, 204, 212):
        win(x, 64 if x < 130 or x > 190 else 59, warm=x in (116, 204))
    # banners
    for x in (146, 171):
        rect(x, 58, x + 3, 67, 'teal1')
        vline(x, 58, 67, 'teal2')
        px(x + 1, 61, 'gold0')
    # flag on the main ridge
    vline(160, 4, 16, 'ink')
    for y in range(5, 10):
        hline(161, 161 + 7 - abs(y - 7) * 2, y, 'r0' if y < 8 else 'r1')


def tavern():
    hip_roof(22, 40, 82, 66, ('b0', 'b1', 'b2', 'b3'))
    chimney(70, 34)
    front_wall(25, 79, 66, 11, 'plaster')
    door(47, 69, 7, 8)
    for x in (30, 38, 60, 70):
        win(x, 69, warm=True)
    # hanging mug sign
    vline(57, 66, 69, 'ink')
    rect(55, 69, 61, 74, 'wd0')
    frame(55, 69, 61, 74, 'ink')
    rect(57, 70, 60, 73, 'gold0')
    px(57, 70, 'mar0'); px(58, 70, 'mar0')
    for bx in (16, 84):
        barrel(bx, 70)


def exchange():
    hip_roof(236, 40, 300, 64, ('s0', 's1', 's2', 's3'))
    front_wall(239, 297, 64, 13, 'stone')
    # pediment band with gold coin
    rect(258, 56, 278, 64, 'mar0')
    frame(258, 56, 278, 65, 'ink')
    ellipse(268, 60, 3.4, 3, 'gold2')
    ellipse(268, 60, 2.6, 2.2, 'gold0')
    vline(268, 58, 63, 'gold1')
    # columns and door
    for cx in (244, 252, 284, 292):
        rect(cx, 64, cx + 3, 77, 'mar0')
        vline(cx + 2, 64, 77, 'mar1')
        frame(cx, 64, cx + 3, 77, 'st3')
    door(264, 69, 8, 8)
    for x in (258, 274):
        rect(x, 66, x + 3, 74, 'teal1')
        px(x + 1, 68, 'gold0')
    # price board
    rect(262, 65, 274, 68, 'ink')
    for i, x in enumerate(range(263, 273)):
        px(x, 67 - (i // 3) % 2, 'teal0')


def cottage(x0, y0, w, roof):
    hip_roof(x0, y0, x0 + w, y0 + 18, roof)
    front_wall(x0 + 3, x0 + w - 3, y0 + 18, 9, 'wood')
    door(x0 + w // 2 - 3, y0 + 20, 6, 7)
    win(x0 + 6, y0 + 21)
    win(x0 + w - 10, y0 + 21, warm=True)


def barrel(x, y):
    shade(x + 1, y + 5, x + 6, y + 7)
    rect(x, y, x + 5, y + 6, 'wd1')
    frame(x, y, x + 5, y + 6, 'ink')
    hline(x + 1, x + 4, y + 2, 'wd2')
    px(x + 1, y + 1, 'wd0')


def crate(x, y):
    shade(x + 1, y + 5, x + 7, y + 7)
    rect(x, y, x + 6, y + 6, 'wd0')
    frame(x, y, x + 6, y + 6, 'ink')
    for i in range(1, 5):
        px(x + i, y + i, 'wd2')


def lamp(x, y):
    shade(x + 1, y, x + 4, y + 2)
    vline(x, y - 8, y + 1, 'ink')
    rect(x - 1, y - 11, x + 2, y - 8, 'ink')
    px(x, y - 10, 'lampglow'); px(x, y - 9, 'lampglow')


def cart(x, y):
    shade(x + 1, y + 6, x + 13, y + 8)
    rect(x, y, x + 11, y + 5, 'wd0')
    frame(x, y, x + 11, y + 5, 'ink')
    hline(x + 1, x + 10, y + 1, 'crop2')
    hline(x + 1, x + 10, y + 2, 'flower0')
    ellipse(x + 2, y + 6, 1.6, 1.6, 'ink')
    ellipse(x + 9, y + 6, 1.6, 1.6, 'ink')
    hline(x + 11, x + 15, y + 3, 'wd2')


def well(x, y):
    soft_shade(x + 4, y + 7, 6, 2)
    ellipse(x + 3, y + 4, 4.5, 3.5, 'ink')
    ellipse(x + 3, y + 4, 3.8, 2.8, 'st1')
    ellipse(x + 3, y + 4, 2.2, 1.6, 'w2')
    rect(x - 2, y - 4, x + 9, y - 1, 'r1')
    frame(x - 2, y - 4, x + 9, y - 1, 'ink')
    vline(x - 1, y - 1, y + 4, 'wd2')
    vline(x + 7, y - 1, y + 4, 'wd2')


# ---------------------------------------------------------------- compose

def scene():
    grass()
    # roads
    road(0, 84, W, 94)          # main street
    road(154, 94, 166, H)       # south avenue
    road(46, 77, 58, 84)        # tavern step
    road(262, 77, 274, 84)      # exchange step
    road(100, 94, 110, H)       # west lane to the garden
    road(214, 94, 224, H)       # east lane
    road(0, 140, 100, 147)      # lane across the garden
    plaza(120, 74, 200, 96)

    # Townhall district
    townhall()
    tavern()
    exchange()

    # statue pools in front of the plaza
    pool(116, 100, 150, 132)
    pool(170, 100, 204, 132)
    for x in (112, 152, 166, 206):
        lamp(x, 98)

    # Garden: fenced striped fields west of the square
    fence_h(6, 96, 100)
    fence_v(6, 100, 138)
    fence_v(95, 100, 138)
    field(10, 104, 48, 136)
    field(54, 104, 92, 136)
    field(10, 150, 48, 176)
    field(54, 150, 92, 176)
    cart(76, 140)

    # a few town houses on the east side (future buildings)
    cottage(232, 104, 34, ('r0', 'r1', 'r2', 'r3'))
    cottage(272, 104, 40, ('s0', 's1', 's2', 's3'))
    cottage(232, 146, 34, ('s0', 's1', 's2', 's3'))
    well(284, 154)
    crate(298, 150)

    # trees, pines and hedges
    for (x, y, r) in ((8, 18, 7), (24, 12, 6), (96, 14, 7), (88, 34, 5), (228, 14, 7), (306, 16, 7),
                      (314, 40, 5), (6, 46, 5), (128, 150, 6), (142, 168, 5), (190, 150, 6), (178, 170, 5),
                      (306, 74, 5), (12, 78, 4), (70, 12, 6), (114, 20, 5), (204, 12, 5), (250, 22, 6),
                      (272, 14, 5), (290, 30, 5), (316, 98, 4), (226, 100, 3), (312, 122, 4), (128, 104, 0)):
        if r:
            round_tree(x, y, r)
    for (x, y) in ((100, 100), (8, 92), (240, 98), (262, 140), (296, 172), (148, 160), (172, 160)):
        round_tree(x, y, 3)
    for (x, y, h) in ((40, 26, 12), (52, 22, 11), (214, 28, 11), (226, 36, 9), (116, 172, 10), (204, 174, 10),
                      (306, 140, 10), (230, 178, 9)):
        pine(x, y, h)
    hedge(116, 136, 150, 140)
    hedge(170, 136, 204, 140)
    flowers(112, 140, 154, 152, 30)
    flowers(166, 140, 210, 152, 30)
    flowers(0, 30, 40, 80, 25)
    for bx, by in ((36, 72), (228, 72)):
        crate(bx, by)


def save(path, scale):
    scene()
    ppm = path + '.ppm'
    with open(ppm, 'wb') as f:
        f.write(b'P6 %d %d 255\n' % (W * scale, H * scale))
        for row in img:
            line = b''.join(bytes(c) * scale for c in row)
            f.write(line * scale)
    subprocess.run(['sips', '-s', 'format', 'png', ppm, '--out', path], check=True, capture_output=True)
    os.remove(ppm)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'empire-scene.png')
    save(out, int(sys.argv[2]) if len(sys.argv) > 2 else 4)
    print('wrote', out)
