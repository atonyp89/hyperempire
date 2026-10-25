"""Pack same-size RGBA PNG frames side by side into one spritesheet (standard library only).

    python3 sheet.py out.png frame0.png frame1.png ...

Used for the PixelLab hero exports in src/web/public/empire/heroes/ (8-bit RGBA, non-interlaced).
"""

import struct
import sys
import zlib


def read_rgba(path):
    data = open(path, 'rb').read()
    pos, idat, w, h = 8, b'', 0, 0
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if kind == b'IHDR':
            w, h, depth, color = struct.unpack('>IIBB', body[:10])
            assert (depth, color) == (8, 6), f'{path}: expected 8-bit RGBA'
        elif kind == b'IDAT':
            idat += body
        pos += 12 + n
    raw, stride, rows, prev = zlib.decompress(idat), w * 4, [], bytearray(w * 4)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            b = prev[i]
            c = prev[i - 4] if i >= 4 else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, rows


def write_png(path, w, h, rows):
    raw = b''.join(b'\0' + bytes(r) for r in rows)
    chunk = lambda k, d: struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    open(path, 'wb').write(png + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    out, frames = sys.argv[1], [read_rgba(p) for p in sys.argv[2:]]
    w, h = frames[0][0], frames[0][1]
    assert all(f[0] == w and f[1] == h for f in frames), 'frames must share one size'
    rows = [b''.join(f[2][y] for f in frames) for y in range(h)]
    write_png(out, w * len(frames), h, rows)
    print(f'{out}: {len(frames)} frames of {w}x{h}')


if __name__ == '__main__':
    main()
