// Database schema (Drizzle, Postgres). The same tables run on PGlite in the browser during development and on
// Postgres in production; migrations.ts creates them. One database per Hyperliquid network.

import { bigint, boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/** One row per wallet that has signed in. `balance` is in milli-$aura (see rules/aura.ts); `gold` in whole $gold. */
export const accounts = pgTable('accounts', {
  address: text('address').primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
  gold: bigint('gold', { mode: 'number' }).notNull().default(0),
  /** Time (ms) of the newest Hyperliquid fill already read, so each sync only reads newer fills. Starts at sign-up. */
  fillsSyncedUntil: bigint('fills_synced_until', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Every $aura and $gold movement, append-only. `ref` makes a credit idempotent (e.g. a fill's trade id). */
export const ledger = pgTable(
  'ledger',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    delta: bigint('delta', { mode: 'number' }).notNull(),
    /** 'aura' (delta in milli-$aura) or 'gold' (delta in whole $gold). */
    currency: text('currency').notNull().default('aura'),
    kind: text('kind').notNull(),
    ref: text('ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ledger_ref').on(t.address, t.currency, t.kind, t.ref), index('ledger_address').on(t.address)],
);

export const nonces = pgTable('nonces', {
  nonce: text('nonce').primaryKey(),
  address: text('address').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  address: text('address').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});

export const townhalls = pgTable('townhalls', {
  address: text('address').primaryKey(),
  level: integer('level').notNull().default(1),
});

export const miners = pgTable(
  'miners',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    grade: smallint('grade').notNull(),
    energy: doublePrecision('energy').notNull().default(100),
    /** Pool it works in ("aura:shared"), or null when idle. */
    pool: text('pool'),
    /** First block it mines in its pool (after walking there). */
    readyHeight: bigint('ready_height', { mode: 'number' }),
    pickId: integer('pick_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('miners_address').on(t.address), index('miners_pool').on(t.pool)],
);

export const picks = pgTable(
  'picks',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    grade: smallint('grade').notNull(),
    /** 0-100; wears down every block its Miner mines. */
    durability: doublePrecision('durability').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('picks_address').on(t.address)],
);

/** Single-row chain state: the last block whose rewards were paid. */
export const chain = pgTable('chain', {
  id: smallint('id').primaryKey(),
  settledHeight: bigint('settled_height', { mode: 'number' }).notNull(),
});

/** Rush pool winners, kept for the Mine screen's history. */
export const rushWins = pgTable(
  'rush_wins',
  {
    height: bigint('height', { mode: 'number' }).notNull(),
    pool: text('pool').notNull(),
    address: text('address'),
    amount: bigint('amount', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('rush_wins_block').on(t.height, t.pool)],
);

/** Orders placed through the HyperEmpire Exchange, reported by the client. On testnet only their fills count. */
export const exchangeOrders = pgTable(
  'exchange_orders',
  {
    address: text('address').notNull(),
    oid: bigint('oid', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.oid] })],
);

/**
 * Builder fees paid, per day. `source` is 'file' (Hyperliquid's daily builder-fill file: the truth on mainnet) or
 * 'fill' (seen live in the player's fills: today's estimate, and the truth on testnet, which has no files).
 */
export const exchangeFees = pgTable(
  'exchange_fees',
  {
    day: text('day').notNull(),
    ref: text('ref').notNull(),
    address: text('address').notNull(),
    source: text('source').notNull(),
    feeMicro: bigint('fee_micro', { mode: 'number' }).notNull(),
    time: bigint('time', { mode: 'number' }).notNull(),
    /** The trade's value (price × size) in micro-USD, and whether it was a taker fill. Null on rows from before Mastery. */
    notionalMicro: bigint('notional_micro', { mode: 'number' }),
    crossed: boolean('crossed'),
  },
  (t) => [primaryKey({ columns: [t.day, t.ref] }), index('exchange_fees_address').on(t.address, t.day)],
);

/** A settled day: its pool, total fees and where they came from. */
export const exchangeDays = pgTable('exchange_days', {
  day: text('day').primaryKey(),
  emission: bigint('emission', { mode: 'number' }).notNull(),
  totalFeeMicro: bigint('total_fee_micro', { mode: 'number' }).notNull(),
  /** Sum of every player's pool weight (counted fees with Mastery perks); shares are split by weight. */
  totalWeightMicro: bigint('total_weight_micro', { mode: 'number' }),
  players: integer('players').notNull(),
  source: text('source').notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Each player's share of a settled day, in milli-$aura. Credited to the ledger once the player has an account. */
export const exchangeRewards = pgTable(
  'exchange_rewards',
  {
    day: text('day').notNull(),
    address: text('address').notNull(),
    feeMicro: bigint('fee_micro', { mode: 'number' }).notNull(),
    /** This player's pool weight that day. */
    weightMicro: bigint('weight_micro', { mode: 'number' }),
    units: bigint('units', { mode: 'number' }).notNull(),
    /** Exchange Mastery XP earned that day, before the Townhall bonus. */
    xp: bigint('xp', { mode: 'number' }).notNull().default(0),
    /** Set once the $aura and XP are credited (the player may sign up after the day settles). */
    credited: boolean('credited').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.day, t.address] }), index('exchange_rewards_address').on(t.address)],
);

/** Each player's Mastery per building: total XP (uncapped), perk ranks and respecs. The level is derived. */
export const masteries = pgTable(
  'masteries',
  {
    address: text('address').notNull(),
    building: text('building').notNull(),
    xp: bigint('xp', { mode: 'number' }).notNull().default(0),
    ranks: jsonb('ranks').$type<Record<string, number>>().notNull().default({}),
    respecs: integer('respecs').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.address, t.building] })],
);

/** A planted Garden plot (empty plots have no row). `slot` is 0-15, row by row; `plantedAt` is ms. */
export const gardenPlots = pgTable(
  'garden_plots',
  {
    address: text('address').notNull(),
    slot: smallint('slot').notNull(),
    crop: text('crop').notNull(),
    /** The seed's grade: index into GRADES (rules/mining.ts), 0 = common. */
    grade: smallint('grade').notNull().default(0),
    plantedAt: bigint('planted_at', { mode: 'number' }).notNull(),
    /** Growing time it was planted with (Farmers and dev speed included); null on plots from before Farmers. */
    growMs: bigint('grow_ms', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.address, t.slot] })],
);

/** Items a player holds, by id: crops ("wheat"), seed packs ("wheat-pack") and graded seeds ("wheat-seed:rare"). */
export const inventory = pgTable(
  'inventory',
  {
    address: text('address').notNull(),
    item: text('item').notNull(),
    qty: bigint('qty', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.address, t.item] })],
);

/** A Farmer: grade (index into GRADES), its two rolled perks in whole percent, and whether it works the Garden. */
export const farmers = pgTable(
  'farmers',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    grade: smallint('grade').notNull(),
    yieldPct: smallint('yield_pct').notNull(),
    growthPct: smallint('growth_pct').notNull(),
    assigned: boolean('assigned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('farmers_address').on(t.address)],
);
