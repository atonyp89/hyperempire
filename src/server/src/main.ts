// Production entry: serves the API with Bun. Uses Postgres when DATABASE_URL is set, otherwise a PGlite database
// on disk (./data/<network>) for running the server locally. A timer settles blocks every 60 s, so rush wins
// and payouts happen even when nobody calls the API.
//
//   NETWORK=testnet PORT=8787 ALLOWED_ORIGINS=http://localhost:5173 bun src/main.ts

import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createApp } from './app';
import { settle } from './blocks';
import { schema, type Db } from './db';
import { migrate } from './db/migrations';
import { secureRandom, type Deps, type Network } from './deps';
import { fillsReader } from './hyperliquid';
import { BLOCK_MS } from './rules/mining';

const network: Network = process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const db = (
  process.env.DATABASE_URL
    ? drizzlePostgres(postgres(process.env.DATABASE_URL), { schema })
    : drizzlePglite(await PGlite.create((mkdirSync('./data', { recursive: true }), `./data/${network}`)), { schema })
) as unknown as Db;
await migrate(db);

const deps: Deps = { db, network, now: Date.now, random: secureRandom, fills: fillsReader(network), allowedOrigins };
const app = createApp(deps);

setInterval(() => settle(deps).catch((err) => console.error('[blocks]', err)), BLOCK_MS);

Bun.serve({ port, fetch: app.fetch });
console.log(`HyperEmpire API (${network}) on http://localhost:${port}${process.env.DATABASE_URL ? '' : ' with a local PGlite database'}`);
