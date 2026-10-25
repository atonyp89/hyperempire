"""Render a pixel-sprite text grid to PNG.

Usage: python3 render.py knight-front.txt out.png [scale]

Each line of the grid is one pixel row; each character maps to a colour in
PALETTE ('.' is transparent and drawn as the background). Uses only the
standard library plus macOS `sips` to convert the PPM it writes to PNG.
"""
import os
import subprocess
import sys

ACCENT = '#2EE6C5'


def mix(hex_color, f):
    rgb = [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join('%02x' % round(f(v)) for v in rgb)


PALETTE = {
    'K': '#1B1730',                                  # outline
    '1': '#F4F7FB', '2': '#C3CCDB', '3': '#8C98B0',  # steel, light to dark
    '4': '#58627E', '5': '#363D57',
    'G': '#FFD45C', 'g': '#C98F2A',                  # gold
    'R': '#E2455B',                                  # gem
    'A': mix(ACCENT, lambda v: v + (255 - v) * 0.45),
    'a': ACCENT,
    'c': mix(ACCENT, lambda v: v * 0.6),
    'd': mix(ACCENT, lambda v: v * 0.34),
    'V': '#0B0A16',                                  # visor
    'E': mix(ACCENT, lambda v: v + (255 - v) * 0.8), # eye glow
    'F': '#F7D4BC', 'f': '#DDA88E',                  # skin
    'r': '#E88A90', 'm': '#9C3D4A',                  # blush, mouth
    'L': '#8A5532', 'l': '#5A341E',                  # leather
}
BACKGROUND = (16, 20, 42)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    rows = [r.rstrip('\n') for r in open(src) if r.strip()]
    width = max(len(r) for r in rows)
    out = bytearray()
    for r in rows:
        line = bytearray()
        for ch in r.ljust(width, '.'):
            c = PALETTE.get(ch)
            px = bytes(int(c[i:i + 2], 16) for i in (1, 3, 5)) if c else bytes(BACKGROUND)
            line += px * scale
        out += bytes(line) * scale
    ppm = dst + '.ppm'
    with open(ppm, 'wb') as f:
        f.write(b'P6 %d %d 255\n' % (width * scale, len(rows) * scale) + bytes(out))
    subprocess.run(['sips', '-s', 'format', 'png', ppm, '--out', dst], check=True, capture_output=True)
    os.remove(ppm)


if __name__ == '__main__':
    main()
