"""Paint cut-out sprites out of the scene, so animated copies can move without a ghost underneath.

Usage: python3 remove_sprites.py scene.png out.png sprite.png:x,y [sprite.png:x,y ...]

Each opaque pixel of a sprite placed at (x, y) is replaced with the nearest non-sprite pixel on the
same row (grass, path), which keeps the ground texture. Standard library + macOS `sips`.
"""
import os
import struct
import subprocess
import sys
import tempfile
import zlib


def read_rgba(path):
    tmp = tempfile.mktemp(suffix='.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', path, '--out', tmp], check=True, capture_output=True)
    d = open(tmp, 'rb').read()
    os.remove(tmp)
    off = struct.unpack_from('<I', d, 10)[0]
    w, h = struct.unpack_from('<ii', d, 18)
    bpp = struct.unpack_from('<H', d, 28)[0] // 8
    row = (w * bpp + 3) // 4 * 4
    flip, h = h > 0, abs(h)
    out = []
    for y in range(h):
        sy = h - 1 - y if flip else y
        r = d[off + sy * row: off + sy * row + w * bpp]
        out.append([(r[i * bpp + 2], r[i * bpp + 1], r[i * bpp], r[i * bpp + 3] if bpp == 4 else 255) for i in range(w)])
    return out


def write_png(path, rows):
    h, w = len(rows), len(rows[0])
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p) for row in rows)

    def chunk(t, data):
        c = struct.pack('>I', len(data)) + t + data
        return c + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    open(path, 'wb').write(png + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    scene = read_rgba(sys.argv[1])
    h, w = len(scene), len(scene[0])
    mask = [[False] * w for _ in range(h)]
    for spec in sys.argv[3:]:
        path, pos = spec.rsplit(':', 1)
        sx, sy = map(int, pos.split(','))
        for y, row in enumerate(read_rgba(path)):
            for x, p in enumerate(row):
                if p[3] > 0 and 0 <= sy + y < h and 0 <= sx + x < w:
                    mask[sy + y][sx + x] = True
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dx in range(1, w):
                for nx in (x - dx, x + dx):
                    if 0 <= nx < w and not mask[y][nx]:
                        scene[y][x] = scene[y][nx]
                        break
                else:
                    continue
                break
    write_png(sys.argv[2], scene)
    print('wrote', sys.argv[2])


if __name__ == '__main__':
    main()
