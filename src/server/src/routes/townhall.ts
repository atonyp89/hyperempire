// Townhall: level, risky upgrades, the perk tree and respecs. Rules in rules/empire.ts; every $aura spent burns.

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Conn } from '../db';
import { townhalls } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict } from '../errors';
import { balanceOf, debit } from '../ledger';
import { fromUnits, toUnits } from '../rules/aura';
import { branchSpent, levelCost, perkPoints, PERKS, respecCost, TIER_POINTS, totalSpent } from '../rules/empire';
import type { TownhallView } from '../contract';

export async function loadTownhall(tx: Conn, address: string) {
  await tx.insert(townhalls).values({ address }).onConflictDoNothing();
  const [t] = await tx.select().from(townhalls).where(eq(townhalls.address, address));
  return t;
}

async function view(tx: Conn, address: string): Promise<TownhallView> {
  const t = await loadTownhall(tx, address);
  return {
    level: t.level,
    ranks: t.ranks,
    respecs: t.respecs,
    aura: fromUnits(await balanceOf(tx, address)),
    nextCost: levelCost(t.level),
    points: perkPoints(t.level) - totalSpent(t.ranks),
    respecCost: respecCost(t.level, t.respecs),
  };
}

export const townhall = new Hono<Env>()
  .get('/', async (c) => c.json(await view(c.var.deps.db, c.var.address)))
  .post('/upgrade', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const chance = Number((await c.req.json().catch(() => ({}))).chance);
    if (!Number.isInteger(chance) || chance < 10 || chance > 100 || chance % 10) throw badRequest('Chance must be 10, 20, … 100.');
    const result = await db.transaction(async (tx) => {
      const t = await loadTownhall(tx, address);
      const spent = Math.round((levelCost(t.level) * chance) / 100);
      await debit(tx, address, toUnits(spent), 'townhall:upgrade', undefined);
      const ok = chance >= 100 || random() < chance / 100;
      if (ok) await tx.update(townhalls).set({ level: t.level + 1 }).where(eq(townhalls.address, address));
      return { ok, spent, chance };
    });
    return c.json({ ...result, townhall: await view(db, address) });
  })
  .post('/perks', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const perkId = (await c.req.json().catch(() => ({}))).perkId;
    const perk = PERKS.find((p) => p.id === perkId);
    if (!perk) throw badRequest('Unknown perk.');
    await db.transaction(async (tx) => {
      const t = await loadTownhall(tx, address);
      if (perkPoints(t.level) - totalSpent(t.ranks) < 1) throw conflict('No perk points left.', 'no_points');
      if ((t.ranks[perk.id] ?? 0) >= perk.maxRank) throw conflict('That perk is already at its top rank.', 'max_rank');
      if (branchSpent(t.ranks, perk.branch) < TIER_POINTS[perk.tier]) throw conflict('That tier is still locked.', 'tier_locked');
      await tx.update(townhalls).set({ ranks: { ...t.ranks, [perk.id]: (t.ranks[perk.id] ?? 0) + 1 } }).where(eq(townhalls.address, address));
    });
    return c.json(await view(db, address));
  })
  .post('/respec', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    await db.transaction(async (tx) => {
      const t = await loadTownhall(tx, address);
      if (totalSpent(t.ranks) === 0) throw conflict('There are no perks to reset.', 'nothing_to_reset');
      await debit(tx, address, toUnits(respecCost(t.level, t.respecs)), 'townhall:respec');
      await tx.update(townhalls).set({ ranks: {}, respecs: t.respecs + 1 }).where(eq(townhalls.address, address));
    });
    return c.json(await view(db, address));
  });
