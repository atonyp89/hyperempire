// Reading from Hyperliquid: a wallet's fills (today's fees, and all fees on testnet) and the daily builder-fill
// files (mainnet's source of truth for fees paid to our builder). Used by both the browser runtime and the server.

import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import type { BuilderFill, Fill, Network } from './deps';
import { lz4Decompress } from './lz4';
import { toMicro } from './rules/exchange';

export function fillsReader(network: Network) {
  const info = new InfoClient({ transport: new HttpTransport({ isTestnet: network === 'testnet' }) });
  return async (address: `0x${string}`, sinceMs: number): Promise<Fill[]> => {
    const fills = await info.userFillsByTime({ user: address, startTime: sinceMs });
    return fills.map((f) => ({ tid: f.tid, oid: f.oid, time: f.time, px: f.px, sz: f.sz, crossed: f.crossed, builderFee: f.builderFee }));
  };
}

/**
 * Hyperliquid's daily file of every fill that paid `builder` a fee (mainnet only), or null while it isn't
 * published. A day with no such fills never gets a file, so a file still missing well after the day means none.
 */
export function builderFillsReader(builder: string, fetcher: typeof fetch = fetch) {
  const base = `https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/${builder.toLowerCase()}`;
  return async (day: string): Promise<BuilderFill[] | null> => {
    const res = await fetcher(`${base}/${day}.csv.lz4`);
    // The bucket answers 403 (not 404) for files that don't exist.
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new Error(`Builder fills for ${day}: HTTP ${res.status}`);
    return parseBuilderFills(new TextDecoder().decode(lz4Decompress(new Uint8Array(await res.arrayBuffer()))));
  };
}

/** Parse a builder-fill CSV: time,user,coin,side,px,sz,…,builder_fee (columns found by header name). */
export function parseBuilderFills(csv: string): BuilderFill[] {
  const lines = csv.split('\n').filter((l) => l.trim());
  const head = (lines.shift() ?? '').split(',');
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`Builder fills: no "${name}" column.`);
    return i;
  };
  const [time, user, fee, px, sz, crossed] = [col('time'), col('user'), col('builder_fee'), col('px'), col('sz'), col('crossed')];
  return lines.map((line) => {
    const c = line.split(',');
    return {
      time: Date.parse(c[time]),
      user: c[user].toLowerCase(),
      feeMicro: toMicro(c[fee]),
      notionalMicro: toMicro(Number(c[px]) * Number(c[sz])),
      crossed: c[crossed] === 'true',
    };
  });
}
