// Runs the whole API inside the browser for development: Postgres via PGlite (saved in IndexedDB, one database
// per network) and the same Hono app as production, called in-process. The web app switches to a real server
// by setting VITE_API_URL; nothing else changes.
//
// One tab owns the database at a time. Other tabs (a second game tab, the admin dashboard) send their requests to
// that tab over a BroadcastChannel, like clients of one server; when the owner closes, the next tab takes over.

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createApp } from './app';
import type { Db } from './db';
import { schema } from './db';
import { migrate } from './db/migrations';
import { secureRandom, type AdminCredentials, type Builder, type Network } from './deps';
import { builderFillsReader, fillsReader } from './hyperliquid';
import { GOLD_FAUCET } from './rules/gold';

export type LocalServer = { fetch: (request: Request) => Promise<Response> };
export type LocalOptions = { admin?: AdminCredentials; builder?: Builder };

/** Simulated players, so the local Mine isn't empty. A real server has none. */
const SIMULATED_POWER = { 'aura:shared': 2_000, 'aura:rush': 2_000 } as const;
/** Garden plants grow this much faster while developing: wheat ripens in 18 s instead of 3 minutes. */
const DEV_GAME_SPEED = 10;
/** How long a tab waits for the owner tab to answer before giving up. */
const RELAY_TIMEOUT_MS = 15_000;

type Wire = { id: string; method: string; url: string; headers: [string, string][]; body: string | null };
type WireReply = { id: string; status: number; headers: [string, string][]; body: string };

const servers = new Map<Network, Promise<LocalServer>>();

export function localServer(network: Network, opts: LocalOptions = {}): Promise<LocalServer> {
  let s = servers.get(network);
  if (!s) servers.set(network, (s = start(network, opts)));
  return s;
}

async function start(network: Network, opts: LocalOptions): Promise<LocalServer> {
  const lockName = `hyperempire-db-${network}`;
  const channel = new BroadcastChannel(`hyperempire-api-${network}`);
  let own: Promise<LocalServer['fetch']> | null = null;

  // Owner: open the database and answer every tab's requests.
  const becomeOwner = () => {
    if (own) return own;
    // Listen before the database opens, so requests sent meanwhile wait instead of getting lost.
    channel.onmessage = async (e: MessageEvent<Wire | WireReply>) => {
      const m = e.data;
      if (!('method' in m)) return;
      const res = await (await own!)(new Request(m.url, { method: m.method, headers: m.headers, body: m.body }));
      channel.postMessage({ id: m.id, status: res.status, headers: [...res.headers], body: await res.text() } satisfies WireReply);
    };
    return (own = (async () => {
      const client = await PGlite.create(`idb://hyperempire-${network}`);
      const db = drizzle(client, { schema }) as unknown as Db;
      await migrate(db);
      const app = createApp({
        db,
        network,
        now: Date.now,
        random: secureRandom,
        fills: fillsReader(network),
        builder: opts.builder,
        builderFills: opts.builder && network === 'mainnet' ? builderFillsReader(opts.builder.address) : undefined,
        simulatedPower: SIMULATED_POWER,
        goldFaucet: GOLD_FAUCET,
        gameSpeed: DEV_GAME_SPEED,
        admin: opts.admin,
      });
      return (request: Request) => Promise.resolve(app.fetch(request));
    })());
  };

  // Not the owner (yet): queue for the lock, and become the owner as soon as it's free.
  const owned = await tryLock(lockName);
  if (owned) await becomeOwner();
  else void waitForLock(lockName).then(becomeOwner);

  return {
    async fetch(request) {
      if (own) return (await own)(request);
      return relay(channel, request);
    },
  };
}

/** Send a request to the owner tab and wait for its answer. */
async function relay(channel: BroadcastChannel, request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  const msg: Wire = { id, method: request.method, url: request.url, headers: [...request.headers], body: request.body ? await request.text() : null };
  return new Promise((resolve, reject) => {
    // A separate channel object receives replies, since a channel never hears its own messages.
    const replies = new BroadcastChannel(channel.name);
    const timer = setTimeout(() => {
      replies.close();
      reject(new Error('The HyperEmpire tab that runs the local server stopped answering. Reload this page.'));
    }, RELAY_TIMEOUT_MS);
    replies.onmessage = (e: MessageEvent<Wire | WireReply>) => {
      const m = e.data;
      if ('method' in m || m.id !== id) return;
      clearTimeout(timer);
      replies.close();
      resolve(new Response(m.body, { status: m.status, headers: m.headers }));
    };
    channel.postMessage(msg);
  });
}

/** Take the database lock if no tab holds it; held until this tab closes. */
function tryLock(name: string): Promise<boolean> {
  if (!('locks' in navigator)) return Promise.resolve(true);
  return new Promise((resolve) => {
    void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      resolve(!!lock);
      return lock ? new Promise<void>(() => {}) : undefined;
    });
  });
}

/** Wait until the lock is free, then hold it until this tab closes. */
function waitForLock(name: string): Promise<void> {
  return new Promise((resolve) => {
    void navigator.locks.request(name, () => {
      resolve();
      return new Promise<void>(() => {});
    });
  });
}
