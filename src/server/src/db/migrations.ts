// Ordered SQL migrations, kept as strings so they run the same in the browser (PGlite) and on a server (Postgres).
// Never edit an applied migration; add a new one. `migrate` records applied ids in _migrations.

import { sql } from 'drizzle-orm';
import type { Db } from './index';

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '0001_init',
    sql: `
      CREATE TABLE accounts (
        address text PRIMARY KEY,
        balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
        fills_synced_until bigint NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ledger (
        id serial PRIMARY KEY,
        address text NOT NULL,
        delta bigint NOT NULL,
        kind text NOT NULL,
        ref text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX ledger_ref ON ledger (address, kind, ref);
      CREATE INDEX ledger_address ON ledger (address);
      CREATE TABLE nonces (nonce text PRIMARY KEY, address text NOT NULL, expires_at bigint NOT NULL);
      CREATE TABLE sessions (token text PRIMARY KEY, address text NOT NULL, expires_at bigint NOT NULL);
      CREATE TABLE townhalls (
        address text PRIMARY KEY,
        level integer NOT NULL DEFAULT 1,
        ranks jsonb NOT NULL DEFAULT '{}'::jsonb,
        respecs integer NOT NULL DEFAULT 0
      );
      CREATE TABLE miners (
        id serial PRIMARY KEY,
        address text NOT NULL,
        grade smallint NOT NULL,
        energy double precision NOT NULL DEFAULT 100,
        pool text,
        ready_height bigint,
        pick_id integer,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX miners_address ON miners (address);
      CREATE INDEX miners_pool ON miners (pool);
      CREATE TABLE picks (
        id serial PRIMARY KEY,
        address text NOT NULL,
        grade smallint NOT NULL,
        durability double precision NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX picks_address ON picks (address);
      CREATE TABLE chain (id smallint PRIMARY KEY, settled_height bigint NOT NULL);
      CREATE TABLE rush_wins (height bigint NOT NULL, pool text NOT NULL, address text, amount bigint NOT NULL);
      CREATE UNIQUE INDEX rush_wins_block ON rush_wins (height, pool);
    `,
  },
  {
    id: '0002_exchange_rewards',
    sql: `
      CREATE TABLE exchange_orders (
        address text NOT NULL,
        oid bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (address, oid)
      );
      CREATE TABLE exchange_fees (
        day text NOT NULL,
        ref text NOT NULL,
        address text NOT NULL,
        source text NOT NULL,
        fee_micro bigint NOT NULL,
        time bigint NOT NULL,
        PRIMARY KEY (day, ref)
      );
      CREATE INDEX exchange_fees_address ON exchange_fees (address, day);
      CREATE TABLE exchange_days (
        day text PRIMARY KEY,
        emission bigint NOT NULL,
        total_fee_micro bigint NOT NULL,
        players integer NOT NULL,
        source text NOT NULL,
        settled_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE exchange_rewards (
        day text NOT NULL,
        address text NOT NULL,
        fee_micro bigint NOT NULL,
        units bigint NOT NULL,
        PRIMARY KEY (day, address)
      );
      CREATE INDEX exchange_rewards_address ON exchange_rewards (address);
    `,
  },
  {
    // The Townhall perk tree is replaced by per-building Mastery; its ranks were test data.
    id: '0003_drop_townhall_perks',
    sql: `
      ALTER TABLE townhalls DROP COLUMN ranks;
      ALTER TABLE townhalls DROP COLUMN respecs;
    `,
  },
  {
    // Exchange Mastery: XP and perk ranks per building, and the trade details its pool weights need.
    id: '0004_mastery',
    sql: `
      CREATE TABLE masteries (
        address text NOT NULL,
        building text NOT NULL,
        xp bigint NOT NULL DEFAULT 0,
        ranks jsonb NOT NULL DEFAULT '{}'::jsonb,
        respecs integer NOT NULL DEFAULT 0,
        PRIMARY KEY (address, building)
      );
      ALTER TABLE exchange_fees ADD COLUMN notional_micro bigint;
      ALTER TABLE exchange_fees ADD COLUMN crossed boolean;
      ALTER TABLE exchange_days ADD COLUMN total_weight_micro bigint;
      ALTER TABLE exchange_rewards ADD COLUMN weight_micro bigint;
      ALTER TABLE exchange_rewards ADD COLUMN xp bigint NOT NULL DEFAULT 0;
      ALTER TABLE exchange_rewards ADD COLUMN credited boolean NOT NULL DEFAULT false;
      UPDATE exchange_rewards r SET credited = true
        WHERE EXISTS (SELECT 1 FROM ledger l WHERE l.address = r.address AND l.kind = 'exchange' AND l.ref = r.day);
    `,
  },
];

export async function migrate(db: Db) {
  await db.execute(sql.raw('CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'));
  const done = await db.execute<{ id: string }>(sql.raw('SELECT id FROM _migrations'));
  const applied = new Set(rows<{ id: string }>(done).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await db.transaction(async (tx) => {
      // One statement at a time: drivers run each as a prepared statement, which can't hold several.
      for (const stmt of statements(m.sql)) await tx.execute(sql.raw(stmt));
      await tx.execute(sql`INSERT INTO _migrations (id) VALUES (${m.id})`);
    });
  }
}

/** Split a migration on `;` at line ends. Migrations must not use semicolons inside a statement. */
const statements = (text: string) => text.split(/;\s*\n/).map((s) => s.trim().replace(/;$/, '')).filter(Boolean);

/** Rows from db.execute, whose result shape differs between drivers (PGlite: { rows }, postgres-js: array). */
export function rows<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows: T[] }).rows ?? []);
}
