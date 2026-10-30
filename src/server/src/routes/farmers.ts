// Farmers: recruit at the Tavern for $aura (a random grade and two perks rolled in its range), and put up to 3 to
// work the Garden, where their perks add yield and cut growing time.

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { FarmerView, FarmersView } from '../contract';
import type { Conn } from '../db';
import { farmers } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict, notFound } from '../errors';
import { debit } from '../ledger';
import { toUnits } from '../rules/aura';
import { FARMER_RECRUIT_AURA, FARMER_SLOTS, farmerBonus, rollFarmer } from '../rules/farmers';
import { GRADES, type Grade } from '../rules/mining';

const viewOf = (f: typeof farmers.$inferSelect): FarmerView => ({
  id: f.id,
  grade: (GRADES[f.grade] ?? 'common') as Grade,
  yieldPct: f.yieldPct,
  growthPct: f.growthPct,
  assigned: f.assigned,
});

/** The Farmers working the Garden, for the Garden's growing time and yield. */
export async function gardenFarmers(tx: Conn, address: string) {
  return tx.select().from(farmers).where(and(eq(farmers.address, address), eq(farmers.assigned, true)));
}

async function view(tx: Conn, address: string): Promise<FarmersView> {
  const all = await tx.select().from(farmers).where(eq(farmers.address, address)).orderBy(farmers.id);
  return { farmers: all.map(viewOf), slots: FARMER_SLOTS, recruitAura: FARMER_RECRUIT_AURA, bonus: farmerBonus(all.filter((f) => f.assigned)) };
}

const idParam = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Bad id.');
  return n;
};

export const farmersRoutes = new Hono<Env>()
  .get('/', async (c) => c.json(await view(c.var.deps.db, c.var.address)))

  // Recruit a Farmer at the Tavern: the $aura burns, the grade and both perks are rolled.
  .post('/recruit', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const result = await db.transaction(async (tx) => {
      await debit(tx, address, toUnits(FARMER_RECRUIT_AURA), 'tavern:farmer');
      const f = rollFarmer(random(), random(), random());
      const [row] = await tx
        .insert(farmers)
        .values({ address, grade: GRADES.indexOf(f.grade), yieldPct: f.yieldPct, growthPct: f.growthPct })
        .returning();
      return { farmer: viewOf(row), ...(await view(tx, address)) };
    });
    return c.json(result);
  })

  // Put a Farmer to work in the Garden (at most FARMER_SLOTS), or take it off.
  .post('/:id/assign', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const result = await db.transaction(async (tx) => {
      const [f] = await tx.select().from(farmers).where(and(eq(farmers.id, id), eq(farmers.address, address)));
      if (!f) throw notFound('Farmer');
      if (!f.assigned && (await gardenFarmers(tx, address)).length >= FARMER_SLOTS) {
        throw conflict(`The Garden has room for ${FARMER_SLOTS} Farmers.`, 'garden_full');
      }
      await tx.update(farmers).set({ assigned: true }).where(eq(farmers.id, id));
      return view(tx, address);
    });
    return c.json(result);
  })
  .post('/:id/unassign', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const done = await db.update(farmers).set({ assigned: false }).where(and(eq(farmers.id, id), eq(farmers.address, address))).returning();
    if (!done.length) throw notFound('Farmer');
    return c.json(await view(db, address));
  });
