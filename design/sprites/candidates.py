"""Cut PixelLab Create Image Pro candidates out of the gallery sheet (standard library only).

    python3 candidates.py SHEET.png CELL OUT_DIR      (CELL is 24 for 24×24 candidates, or 40x24)

The sheet holds a grid of candidates, one per CELL, but sprites often spill over their cell edges (a pose
clipped at the feet in one cell continues in the next), so slicing by cell mixes neighbours. Instead
this finds connected pixel groups (8-way), gives each group to the cell holding its centre, and writes
each candidate cropped to its own pixels as OUT_DIR/<index>.png, plus OUT_DIR/contact.png (all of
them on scene grass, 2px apart, in sheet order) for picking.
"""

import os
import sys

from sheet import read_rgba, write_png

GRASS = bytes((0x6a, 0x89, 0x54, 0xff))


def groups(w, h, rows):
    seen, out = set(), []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or rows[y][x * 4 + 3] <= 128:
                continue
            seen.add((x, y))
            stack, pix = [(x, y)], []
            while stack:
                px, py = stack.pop()
                pix.append((px, py))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = px + dx, py + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and rows[ny][nx * 4 + 3] > 128:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            out.append(pix)
    return out


def main():
    sheet, cell, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cell_w, cell_h = (int(v) for v in cell.split('x')) if 'x' in cell else (int(cell), int(cell))
    w, h, rows = read_rgba(sheet)
    n = w // cell_w
    cells = {}
    for pix in groups(w, h, rows):
        cx = sum(p[0] for p in pix) / len(pix)
        cy = sum(p[1] for p in pix) / len(pix)
        cells.setdefault(int(cy // cell_h) * n + int(cx // cell_w), []).extend(pix)
    os.makedirs(out, exist_ok=True)
    crops = {}
    for i, pix in sorted(cells.items()):
        x0, y0 = min(p[0] for p in pix), min(p[1] for p in pix)
        cw, ch = max(p[0] for p in pix) - x0 + 1, max(p[1] for p in pix) - y0 + 1
        img = [bytearray(cw * 4) for _ in range(ch)]
        for x, y in pix:
            img[y - y0][(x - x0) * 4:(x - x0) * 4 + 4] = rows[y][x * 4:x * 4 + 4]
        write_png(os.path.join(out, f'{i}.png'), cw, ch, img)
        crops[i] = (cw, ch, img)
    size = max(max(c[0], c[1]) for c in crops.values()) + 2
    sheet_rows = [bytearray(GRASS * (n * size)) for _ in range(n * size)]
    for i, (cw, ch, img) in crops.items():
        ox = (i % n) * size + (size - cw) // 2
        oy = (i // n) * size + size - ch - 1
        for y in range(ch):
            for x in range(cw):
                if img[y][x * 4 + 3] > 128:
                    sheet_rows[oy + y][(ox + x) * 4:(ox + x) * 4 + 4] = bytes(img[y][x * 4:x * 4 + 3]) + b'\xff'
    write_png(os.path.join(out, 'contact.png'), n * size, n * size, sheet_rows)
    for i, (cw, ch, _) in crops.items():
        print(i, f'{cw}x{ch}')


if __name__ == '__main__':
    main()
