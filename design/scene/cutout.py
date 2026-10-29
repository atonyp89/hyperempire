"""Cut a building out of the scene as a transparent PNG, for shape-following hover highlights.

Usage: python3 cutout.py scene.png out.png x0 y0 x1 y1 [--erase ex0,ey0,ex1,ey1 ...]

--erase clears extra boxes (crop-relative coords, exclusive ends) for stray bits the fill keeps.
--tree floods from the crop edges through everything except dark outline pixels instead, keeping what the
outline encloses (tree canopies are green like the grass, so the ground-colour fill would erase them).
--cut-bottom (with --tree) doesn't flood from the crop's bottom row, for trees the scene's bottom edge cuts off:
their outline is open there.

Crops the box (native-pixel coords, x1/y1 exclusive), then flood-fills from the crop's edges through
"ground" colours (grass, dirt, path, shadow) and makes them transparent. What is left is the building.
Prints the crop box so the web app can position the sprite. Standard library + macOS `sips`.
"""
import colorsys
import os
import struct
import subprocess
import sys
import tempfile
import zlib


def read_rgb(path):
    tmp = tempfile.mktemp(suffix='.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', path, '--out', tmp], check=True, capture_output=True)
    d = open(tmp, 'rb').read()
    os.remove(tmp)
    off = struct.unpack_from('<I', d, 10)[0]
    w, h = struct.unpack_from('<ii', d, 18)
    bpp = struct.unpack_from('<H', d, 28)[0] // 8
    row = (w * bpp + 3) // 4 * 4
    flip, h = h > 0, abs(h)
    px = []
    for y in range(h):
        sy = h - 1 - y if flip else y
        r = d[off + sy * row: off + sy * row + w * bpp]
        px.append([(r[i * bpp + 2], r[i * bpp + 1], r[i * bpp]) for i in range(w)])
    return px


def is_ground(rgb):
    """Grass greens, dirt/path browns and their shadows: low-saturation earthy tones of the ground."""
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
    deg = h * 360
    green = 70 <= deg <= 165 and 0.18 <= l <= 0.55 and s >= 0.12
    dirt = 25 <= deg <= 50 and 0.35 <= l <= 0.62 and 0.12 <= s <= 0.32
    return green or dirt


def is_open(rgb):
    """Anything that is not a dark outline pixel: the tree-mode fill passes through it."""
    return colorsys.rgb_to_hls(*[v / 255 for v in rgb])[1] >= 0.16


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p) for row in rows)

    def chunk(t, data):
        c = struct.pack('>I', len(data)) + t + data
        return c + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    x0, y0, x1, y1 = map(int, sys.argv[3:7])
    args = [a for a in sys.argv[7:] if a not in ('--tree', '--cut-bottom')]
    erase = [tuple(map(int, a.split(','))) for a in args[1::2]] if '--erase' in args else []
    img = read_rgb(src)
    crop = [row[x0:x1] for row in img[y0:y1]]
    h, w = len(crop), len(crop[0])
    clear = [[False] * w for _ in range(h)]
    for ex0, ey0, ex1, ey1 in erase:
        for y in range(max(0, ey0), min(h, ey1)):
            for x in range(max(0, ex0), min(w, ex1)):
                clear[y][x] = True
    rows = (0,) if '--cut-bottom' in sys.argv else (0, h - 1)
    stack = [(x, y) for x in range(w) for y in rows] + [(x, y) for y in range(h) for x in (0, w - 1)]
    tree = '--tree' in sys.argv
    passable = is_open if tree else is_ground
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or clear[y][x] or not passable(crop[y][x]):
            continue
        clear[y][x] = True
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # Keep only the largest connected shape (the building); drop stray specks of path edging and props.
    seen = [[False] * w for _ in range(h)]
    best = set()
    for sy in range(h):
        for sx in range(w):
            if clear[sy][sx] or seen[sy][sx]:
                continue
            part, todo = set(), [(sx, sy)]
            while todo:
                x, y = todo.pop()
                if not (0 <= x < w and 0 <= y < h) or clear[y][x] or seen[y][x]:
                    continue
                seen[y][x] = True
                part.add((x, y))
                todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            if len(part) > len(best):
                best = part
    rows = [[(*crop[y][x], 255) if (x, y) in best else (0, 0, 0, 0) for x in range(w)] for y in range(h)]
    clear = [[(x, y) not in best for x in range(w)] for y in range(h)]
    write_png(dst, w, h, rows)
    kept = sum(not c for row in clear for c in row)
    print(f'wrote {dst} {w}x{h} at ({x0},{y0}); kept {kept} of {w * h} px')


if __name__ == '__main__':
    main()
