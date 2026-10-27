// Everything the app needs from outside, injected so the same code runs in the browser, on a server and in tests.

import type { Db } from './db';
import type { PoolId } from './rules/mining';

export type Network = 'mainnet' | 'testnet';

/** A Hyperliquid fill, as far as $aura cares. */
export type Fill = { tid: number; time: number; builderFee?: string };

export type Deps = {
  db: Db;
  network: Network;
  /** Current time in ms. */
  now: () => number;
  /** Uniform random number in [0, 1); rolls and block draws use it. */
  random: () => number;
  /** Reads fills from Hyperliquid for the fee sync. */
  fills: (address: `0x${string}`, sinceMs: number) => Promise<Fill[]>;
  /**
   * Power added to each pool by simulated players, so a lone developer doesn't win every block. Local and dev
   * only; production leaves it empty.
   */
  simulatedPower?: Partial<Record<PoolId, number>>;
  /** Origins allowed to call the API from a browser (CORS). Not needed when the app runs in-process. */
  allowedOrigins?: string[];
};

/** Uniform random number in [0, 1) from the platform's secure generator (browsers, Bun and Node all have it). */
export function secureRandom(): number {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53;
}

/** Random hex string, for nonces and session tokens. */
export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
