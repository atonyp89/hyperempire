// Runs the whole API inside the browser for development: Postgres via PGlite (saved in IndexedDB, one database
// per network) and the same Hono app as production, called in-process. The web app switches to a real server
// by setting VITE_API_URL; nothing else changes.

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createApp } from './app';
import type { Db } from './db';
import { schema } from './db';
import { migrate } from './db/migrations';
import { secureRandom, type Network } from './deps';
import { fillsReader } from './hyperliquid';

export type LocalServer = { fetch: (request: Request) => Promise<Response> };

/** Simulated players, so the local Mine isn't empty. A real server has none. */
const SIMULATED_POWER = { 'aura:shared': 2_000, 'aura:rush': 2_000 } as const;

const servers = new Map<Network, Promise<LocalServer>>();

export function localServer(network: Network): Promise<LocalServer> {
  let s = servers.get(network);
  if (!s) servers.set(network, (s = start(network)));
  return s;
}

async function start(network: Network): Promise<LocalServer> {
  await holdTabLock(network);
  const client = await PGlite.create(`idb://hyperempire-${network}`);
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db);
  const app = createApp({ db, network, now: Date.now, random: secureRandom, fills: fillsReader(network), simulatedPower: SIMULATED_POWER });
  return { fetch: (request) => Promise.resolve(app.fetch(request)) };
}

/** One tab at a time owns the local database; a second tab would otherwise run its own copy over the same data. */
function holdTabLock(network: Network): Promise<void> {
  if (!('locks' in navigator)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    navigator.locks.request(`hyperempire-db-${network}`, { ifAvailable: true }, (lock) => {
      if (!lock) {
        reject(new Error('HyperEmpire is already open in another tab. Close it to use the local server here.'));
        return;
      }
      resolve();
      return new Promise<void>(() => {}); // held until the tab closes
    });
  });
}
