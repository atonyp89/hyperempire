// The builder-fill file reader: LZ4 frames as the lz4 tool writes them, and the CSV Hyperliquid publishes.
// The fixture is synthetic (made-up wallets) in the real file's format, compressed with `lz4 -9`.

import { describe, expect, test } from 'bun:test';
import { builderFillsReader, parseBuilderFills } from './hyperliquid';
import { lz4Decompress } from './lz4';

const fixture = new Uint8Array(await Bun.file(new URL('./fixtures/builder-fills.csv.lz4', import.meta.url)).arrayBuffer());

describe('builder fills', () => {
  test('decompresses an lz4 frame and parses every row', () => {
    const csv = new TextDecoder().decode(lz4Decompress(fixture));
    expect(csv.startsWith('time,user,coin,side,px,sz,')).toBe(true);
    const rows = parseBuilderFills(csv);
    expect(rows.length).toBe(400);
    expect(rows[0]).toEqual({ time: Date.UTC(2026, 9, 26), user: '0x00000000000000000000000000000000aaaa0000', feeMicro: 40_000 });
    expect(new Set(rows.map((r) => r.user)).size).toBe(3);
  });

  test('reads the day from the lowercase builder path, and a missing file is null', async () => {
    const asked: string[] = [];
    const fake = (async (url: string) => {
      asked.push(url);
      return url.endsWith('20261026.csv.lz4') ? new Response(fixture) : new Response('denied', { status: 403 });
    }) as unknown as typeof fetch;
    const read = builderFillsReader('0xABCdef0000000000000000000000000000000001', fake);
    expect((await read('20261026'))?.length).toBe(400);
    expect(await read('20261027')).toBeNull();
    expect(asked[0]).toBe('https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/0xabcdef0000000000000000000000000000000001/20261026.csv.lz4');
  });

  test('rejects data that is not lz4', () => {
    expect(() => lz4Decompress(new TextEncoder().encode('time,user'))).toThrow();
  });
});
