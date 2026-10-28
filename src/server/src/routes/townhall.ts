// Townhall: level and risky upgrades. Its level caps every building's Mastery and boosts Mastery XP. Rules in
// rules/empire.ts; every $aura spent burns.

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Conn } from '../db';
import { townhalls } from '../db/schema';
import type { Env } from '../env';
import { badRequest } from '../errors';
import { balanceOf, debit } from '../ledger';
import { fromUnits, toUnits } from '../rules/aura';
import { levelCost, MASTERIES, masteryCap, masteryXpBonus } from '../rules/empire';
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
    aura: fromUnits(await balanceOf(tx, address)),
    nextCost: levelCost(t.level),
    masteryCap: masteryCap(t.level),
    masteryXpBonus: masteryXpBonus(t.level),
    // Mastery isn't built yet: every building is at level 0 until its own Mastery ships.
    masteries: MASTERIES.map((m) => ({ id: m.id, level: 0, xp: 0, live: false })),
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
  });
