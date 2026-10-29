// Everything the app needs from outside, injected so the same code runs in the browser, on a server and in tests.

import type { Db } from './db';
import type { PoolId } from './rules/mining';

export type Network = 'mainnet' | 'testnet';

/** A Hyperliquid fill, as far as $aura cares. */
export type Fill = { tid: number; oid: number; time: number; px: string; sz: string; crossed: boolean; builderFee?: string };

/** One row of Hyperliquid's daily builder-fill file: a fill that paid our builder. */
export type BuilderFill = { time: number; user: string; feeMicro: number; notionalMicro: number; crossed: boolean };

/** HyperEmpire's builder code: fills that pay it earn Exchange rewards. */
export type Builder = { address: string; /** The fee we charge, as a fraction (0.0005 = 0.05%). */ feeRate: number };

export type Deps = {
  db: Db;
  network: Network;
  /** Current time in ms. */
  now: () => number;
  /** Uniform random number in [0, 1); rolls and block draws use it. */
  random: () => number;
  /** Reads fills from Hyperliquid for the fee sync. */
  fills: (address: `0x${string}`, sinceMs: number) => Promise<Fill[]>;
  /** Our builder code. Without it, no fees are tracked and no Exchange rewards are paid. */
  builder?: Builder;
  /**
   * Reads Hyperliquid's daily builder-fill file (null until it's published). Mainnet only: when set, the files
   * decide each day's fees; when not (testnet), fills of orders placed through our Exchange do.
   */
  builderFills?: (day: string) => Promise<BuilderFill[] | null>;
  /**
   * Power added to each pool by simulated players, so a lone developer doesn't win every block. Local and dev
   * only; production leaves it empty.
   */
  simulatedPower?: Partial<Record<PoolId, number>>;
  /**
   * How much faster game timers run: Garden growth. Dev only (the in-browser server); production leaves it at 1.
   * Mining blocks and Exchange days keep the real clock, since they line up with Hyperliquid's fills.
   */
  gameSpeed?: number;
  /** $gold per claim of the testing faucet (POST /gold/faucet). Local and testnet only; without it, no faucet. */
  goldFaucet?: number;
  /** Origins allowed to call the API from a browser (CORS). Not needed when the app runs in-process. */
  allowedOrigins?: string[];
  /** Username and password for the read-only admin dashboard (/admin). Without them, /admin doesn't exist. */
  admin?: AdminCredentials;
};

export type AdminCredentials = { user: string; password: string };

/** The shortest admin password accepted; a shorter one leaves the admin dashboard off. */
export const ADMIN_MIN_PASSWORD = 12;

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
