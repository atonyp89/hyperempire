// LZ4 frame decoder, for Hyperliquid's daily builder-fill files (.csv.lz4). Small and dependency-free so it runs
// the same in the browser and on Bun. Checksums are skipped: the files come over HTTPS from Hyperliquid.
// Format: https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md

const FRAME_MAGIC = 0x184d2204;
const SKIPPABLE_MASK = 0xfffffff0;
const SKIPPABLE_MAGIC = 0x184d2a50;

class Out {
  buf = new Uint8Array(1 << 16);
  len = 0;
  reserve(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
}

/** Decompress one or more LZ4 frames. Throws on anything that isn't a valid frame. */
export function lz4Decompress(input: Uint8Array): Uint8Array {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const out = new Out();
  let p = 0;
  while (p < input.length) {
    const magic = view.getUint32(p, true);
    p += 4;
    if ((magic & SKIPPABLE_MASK) === SKIPPABLE_MAGIC) {
      p += 4 + view.getUint32(p, true);
      continue;
    }
    if (magic !== FRAME_MAGIC) throw new Error('Not an LZ4 frame.');
    const flg = input[p];
    if (flg >> 6 !== 1) throw new Error('Unsupported LZ4 frame version.');
    const blockChecksum = (flg & 0x10) !== 0;
    const contentSize = (flg & 0x08) !== 0;
    const contentChecksum = (flg & 0x04) !== 0;
    const dictId = (flg & 0x01) !== 0;
    if (dictId) throw new Error('LZ4 dictionaries are not supported.');
    p += 2 + (contentSize ? 8 : 0) + 1; // FLG, BD, [content size], header checksum

    for (;;) {
      const raw = view.getUint32(p, true);
      p += 4;
      if (raw === 0) break; // end mark
      const size = raw & 0x7fffffff;
      if (raw & 0x80000000) {
        out.reserve(size);
        out.buf.set(input.subarray(p, p + size), out.len);
        out.len += size;
      } else {
        decodeBlock(input, p, p + size, out);
      }
      p += size + (blockChecksum ? 4 : 0);
    }
    if (contentChecksum) p += 4;
  }
  return out.buf.subarray(0, out.len);
}

/** One compressed block: sequences of literals then a match copied from earlier output (which may span blocks). */
function decodeBlock(src: Uint8Array, p: number, end: number, out: Out) {
  while (p < end) {
    const token = src[p++];
    let lit = token >> 4;
    if (lit === 15) {
      let b: number;
      do lit += b = src[p++];
      while (b === 255);
    }
    out.reserve(lit);
    out.buf.set(src.subarray(p, p + lit), out.len);
    out.len += lit;
    p += lit;
    if (p >= end) break; // the last sequence has literals only

    const offset = src[p] | (src[p + 1] << 8);
    p += 2;
    if (offset === 0 || offset > out.len) throw new Error('Corrupt LZ4 block.');
    let len = (token & 15) + 4;
    if ((token & 15) === 15) {
      let b: number;
      do len += b = src[p++];
      while (b === 255);
    }
    out.reserve(len);
    // Byte by byte: a match may overlap the bytes it is producing (offset < length).
    let from = out.len - offset;
    for (let i = 0; i < len; i++) out.buf[out.len++] = out.buf[from++];
  }
}
