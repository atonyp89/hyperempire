// Mastery storage: each player's XP and perk ranks per building, and the level that counts (capped by the
// Townhall). Rules in rules/mastery.ts.

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Conn } from './db';
import { masteries } from './db/schema';
import { masteryXpBonus, type MasteryId } from './rules/empire';
import { masteryLevel, type Ranks } from './rules/mastery';
import { loadTownhall } from './routes/townhall';

export async function loadMastery(tx: Conn, address: string, building: MasteryId) {
  await tx.insert(masteries).values({ address, building }).onConflictDoNothing();
  const [m] = await tx.select().from(masteries).where(and(eq(masteries.address, address), eq(masteries.building, building)));
  const townhall = await loadTownhall(tx, address);
  return { ...m, townhallLevel: townhall.level, ...masteryLevel(m.xp, townhall.level) };
}

/** Perk ranks of many players in one building (players with none are missing). */
export async function ranksOf(tx: Conn, building: MasteryId, addresses: string[]): Promise<Map<string, Ranks>> {
  if (!addresses.length) return new Map();
  const found = await tx
    .select({ address: masteries.address, ranks: masteries.ranks })
    .from(masteries)
    .where(and(eq(masteries.building, building), inArray(masteries.address, addresses)));
  return new Map(found.map((m) => [m.address, m.ranks]));
}

/** Add Mastery XP, with the Townhall's +1% per level. XP is never capped; only the level is. */
export async function addXp(tx: Conn, address: string, building: MasteryId, xp: number) {
  if (xp <= 0) return 0;
  const townhall = await loadTownhall(tx, address);
  const gained = Math.floor(xp * (1 + masteryXpBonus(townhall.level)));
  await tx
    .insert(masteries)
    .values({ address, building, xp: gained })
    .onConflictDoUpdate({ target: [masteries.address, masteries.building], set: { xp: sql`${masteries.xp} + ${gained}` } });
  return gained;
}
