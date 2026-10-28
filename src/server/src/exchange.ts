// Exchange rewards (rules in rules/exchange.ts): record builder fees per day, then settle each finished day by
// sharing its fixed $aura pool across the fees paid that day.
//
// Where fees come from:
//   mainnet: Hyperliquid's daily builder-fill file, which lists only fills that paid OUR builder. Live fills of
//            orders placed through our Exchange give today's estimate (pending $aura).
//   testnet: no files exist, so fills of orders our Exchange reported, at no more than our fee rate, count.

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Conn } from './db';
import { accounts, exchangeDays, exchangeFees, exchangeOrders, exchangeRewards, ledger } from './db/schema';
import { rows } from './db/migrations';
import type { BuilderFill, Deps } from './deps';
import { credit } from './ledger';
import { fromUnits, toUnits } from './rules/aura';
import { DAILY_EMISSION, DAY_MS, dayOf, dayStart, fromMicro, nextDay, shareOf, toMicro } from './rules/exchange';
import type { ExchangeView } from './contract';

/** Don't re-read Hyperliquid for the same wallet more often than this. */
const SYNC_EVERY_MS = 30_000;
/** How long after a day ends to keep waiting for its builder file before deciding it had no fills. */
const FILE_GRACE_MS = 36 * 60 * 60_000;
/** How often to retry a builder file that isn't published yet. */
const FILE_RETRY_MS = 10 * 60_000;
/** Days settled in one call, so a long gap can't stall a request. */
const MAX_DAYS = 31;
/** Most order ids accepted in one report. */
export const MAX_ORDERS = 50;

const lastSync = new Map<string, number>();
const lastFileTry = new Map<string, number>();

/** Remember orders our Exchange placed, so their fills count. Rereads the last minute of fills in case one filled first. */
export async function trackOrders(deps: Deps, address: string, oids: number[]) {
  if (!oids.length) return 0;
  const added = await deps.db
    .insert(exchangeOrders)
    .values(oids.map((oid) => ({ address, oid })))
    .onConflictDoNothing()
    .returning({ oid: exchangeOrders.oid });
  const back = deps.now() - 60_000;
  await deps.db
    .update(accounts)
    .set({ fillsSyncedUntil: sql`least(${accounts.fillsSyncedUntil}, ${back})` })
    .where(eq(accounts.address, address));
  lastSync.delete(address);
  return added.length;
}

/** Read the wallet's new fills and record the builder fees of ours. Returns how many fees it recorded. */
export async function syncFills(deps: Deps, address: string, force = false): Promise<number> {
  const { db, builder } = deps;
  if (!builder) return 0;
  const at = deps.now();
  if (!force && at - (lastSync.get(address) ?? 0) < SYNC_EVERY_MS) return 0;
  lastSync.set(address, at);
  const [acc] = await db.select({ until: accounts.fillsSyncedUntil }).from(accounts).where(eq(accounts.address, address));
  if (!acc) return 0;
  const fills = await deps.fills(address as `0x${string}`, acc.until + 1);
  if (!fills.length) return 0;

  const oids = [...new Set(fills.map((f) => f.oid))];
  const ours = new Set(
    (await db.select({ oid: exchangeOrders.oid }).from(exchangeOrders).where(and(eq(exchangeOrders.address, address), inArray(exchangeOrders.oid, oids)))).map(
      (o) => o.oid,
    ),
  );
  let recorded = 0;
  let newest = acc.until;
  await db.transaction(async (tx) => {
    for (const f of fills) {
      newest = Math.max(newest, f.time);
      const fee = Number(f.builderFee ?? 0);
      if (!(fee > 0) || !ours.has(f.oid)) continue;
      // Our fee rate or less (perk discounts lower it). Anything higher went to another builder.
      const notional = Number(f.px) * Number(f.sz);
      if (!(notional > 0) || fee / notional > builder.feeRate * 1.0001) continue;
      const row = await tx
        .insert(exchangeFees)
        .values({ day: dayOf(f.time), ref: `fill:${address}:${f.tid}`, address, source: 'fill', feeMicro: toMicro(fee), time: f.time })
        .onConflictDoNothing()
        .returning({ ref: exchangeFees.ref });
      recorded += row.length;
    }
    if (newest > acc.until) await tx.update(accounts).set({ fillsSyncedUntil: newest }).where(eq(accounts.address, address));
  });
  return recorded;
}

/** The first day that could have fees: the earliest recorded fee or account. */
async function firstDay(db: Conn): Promise<string | null> {
  const [r] = rows<{ fee_day: string | null; account_ms: number | string | null }>(
    await db.execute(sql`
      SELECT (SELECT min(day) FROM exchange_fees) AS fee_day,
             (SELECT (extract(epoch FROM min(created_at)) * 1000)::bigint FROM accounts) AS account_ms`),
  );
  const days = [r?.fee_day, r?.account_ms != null ? dayOf(Number(r.account_ms)) : null].filter((d): d is string => !!d);
  return days.length ? days.sort()[0] : null;
}

/** Settle every finished day not settled yet: share its pool by fees and credit players. Returns days settled. */
export async function settleDays(deps: Deps): Promise<number> {
  const { db, builder } = deps;
  if (!builder) return 0;
  const today = dayOf(deps.now());
  const first = await firstDay(db);
  if (!first) return 0;
  const settled = new Set((await db.select({ day: exchangeDays.day }).from(exchangeDays)).map((d) => d.day));

  let done = 0;
  for (let day = first, n = 0; day < today && n < MAX_DAYS; day = nextDay(day), n++) {
    if (settled.has(day)) continue;
    let file: BuilderFill[] | null = null;
    if (deps.builderFills) {
      const key = `${builder.address}:${day}`;
      if (deps.now() - (lastFileTry.get(key) ?? 0) < FILE_RETRY_MS) break;
      lastFileTry.set(key, deps.now());
      file = await deps.builderFills(day);
      if (!file) {
        // Not published yet: wait (later days too, so days settle in order). Long after the day: no fills.
        if (deps.now() < dayStart(day) + DAY_MS + FILE_GRACE_MS) break;
        file = [];
      }
    }
    if (await settleDay(deps, day, file)) done++;
  }
  return done;
}

async function settleDay(deps: Deps, day: string, file: BuilderFill[] | null): Promise<boolean> {
  return deps.db.transaction(async (tx) => {
    if (file) {
      for (let i = 0; i < file.length; i += 500) {
        const chunk = file.slice(i, i + 500).map((f, j) => ({ day, ref: `file:${i + j}`, address: f.user, source: 'file', feeMicro: f.feeMicro, time: f.time }));
        if (chunk.length) await tx.insert(exchangeFees).values(chunk).onConflictDoNothing();
      }
    }
    const source = file ? 'file' : 'fill';
    const byAddress = rows<{ address: string; fee: number | string }>(
      await tx.execute(sql`SELECT address, sum(fee_micro)::bigint AS fee FROM exchange_fees WHERE day = ${day} AND source = ${source} GROUP BY address`),
    ).map((r) => ({ address: r.address, fee: Number(r.fee) }));
    const total = byAddress.reduce((s, r) => s + r.fee, 0);
    const emission = toUnits(DAILY_EMISSION);
    const claimed = await tx
      .insert(exchangeDays)
      .values({ day, emission, totalFeeMicro: total, players: byAddress.length, source: file ? 'file' : 'fills' })
      .onConflictDoNothing()
      .returning({ day: exchangeDays.day });
    if (!claimed.length) return false; // settled by another request meanwhile
    if (byAddress.length) {
      await tx
        .insert(exchangeRewards)
        .values(byAddress.map((r) => ({ day, address: r.address, feeMicro: r.fee, units: Math.floor(shareOf(emission, r.fee, total)) })))
        .onConflictDoNothing();
    }
    await creditRewards(tx);
    return true;
  });
}

/** Credit settled shares to players who have an account (all of them, or one). Idempotent per day. */
export async function creditRewards(tx: Conn, address?: string) {
  const due = await tx
    .select({ day: exchangeRewards.day, address: exchangeRewards.address, units: exchangeRewards.units })
    .from(exchangeRewards)
    .innerJoin(accounts, eq(accounts.address, exchangeRewards.address))
    .leftJoin(ledger, and(eq(ledger.address, exchangeRewards.address), eq(ledger.kind, 'exchange'), eq(ledger.ref, exchangeRewards.day)))
    .where(and(isNull(ledger.id), address ? eq(exchangeRewards.address, address) : undefined));
  for (const r of due) await credit(tx, r.address, r.units, 'exchange', r.day);
}

/** Today's pool and the player's place in it, their unsettled $aura, and recent days. */
export async function exchangeView(deps: Deps, address: string): Promise<ExchangeView> {
  const { db } = deps;
  const today = dayOf(deps.now());
  const settled = new Set((await db.select({ day: exchangeDays.day }).from(exchangeDays)).map((d) => d.day));
  // Live totals per unsettled day, from fills seen so far.
  const live = rows<{ day: string; total: number | string; yours: number | string }>(
    await db.execute(sql`
      SELECT day, sum(fee_micro)::bigint AS total, coalesce(sum(fee_micro) FILTER (WHERE address = ${address}), 0)::bigint AS yours
      FROM exchange_fees WHERE source = 'fill' AND day >= ${dayOf(deps.now() - MAX_DAYS * DAY_MS)} GROUP BY day`),
  ).map((r) => ({ day: r.day, total: Number(r.total), yours: Number(r.yours) }));
  const t = live.find((d) => d.day === today) ?? { day: today, total: 0, yours: 0 };
  const pending = live.filter((d) => !settled.has(d.day)).reduce((s, d) => s + shareOf(DAILY_EMISSION, d.yours, d.total), 0);

  const history = rows<{ day: string; emission: number | string; total_fee_micro: number | string; players: number; source: string; fee_micro: number | string | null; units: number | string | null }>(
    await db.execute(sql`
      SELECT d.day, d.emission, d.total_fee_micro, d.players, d.source, r.fee_micro, r.units
      FROM exchange_days d LEFT JOIN exchange_rewards r ON r.day = d.day AND r.address = ${address}
      ORDER BY d.day DESC LIMIT 14`),
  );
  return {
    day: today,
    endsAt: dayStart(today) + DAY_MS,
    emission: DAILY_EMISSION,
    source: deps.builderFills ? 'file' : 'fills',
    totalFees: fromMicro(t.total),
    yourFees: fromMicro(t.yours),
    yourEstimate: shareOf(DAILY_EMISSION, t.yours, t.total),
    pendingAura: pending,
    history: history.map((h) => ({
      day: h.day,
      emission: fromUnits(Number(h.emission)),
      totalFees: fromMicro(Number(h.total_fee_micro)),
      players: Number(h.players),
      source: h.source as 'file' | 'fills',
      yourFees: fromMicro(Number(h.fee_micro ?? 0)),
      yourAura: fromUnits(Number(h.units ?? 0)),
    })),
  };
}
