// Farmers: recruit at the Tavern for $aura (a random grade and two perks rolled in its range), and put up to 3 to
// work the Garden, where their perks add yield and cut growing time. Working Farmers get hungry: bread feeds them,
// and one that reaches 0 dies, adding nothing until $aura revives it. Resting Farmers don't get hungry.

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { FarmerView, FarmersView } from '../contract';
import type { Conn } from '../db';
import { farmers } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict, notFound } from '../errors';
import { takeItem } from '../inventory';
import { debit } from '../ledger';
import { toUnits } from '../rules/aura';
import { FARMER_RECRUIT_AURA, FARMER_SLOTS, farmerBonus, rollFarmer } from '../rules/farmers';
import { BREAD_HUNGER, diesAt, HUNGER_FULL, hungerAt, REVIVE_AURA, REVIVE_HUNGER } from '../rules/food';
import { GRADES, type Grade } from '../rules/mining';

type Farmer = typeof farmers.$inferSelect;

/** Hunger a dev drain takes off. */
const DRAIN = 25;

const gradeOf = (f: Farmer) => (GRADES[f.grade] ?? 'common') as Grade;
const hungerOf = (f: Farmer, now: number, speed: number) => hungerAt(f.hunger, f.hungerSince, now, speed);

export function farmerView(f: Farmer, now: number, speed: number): FarmerView {
  const hunger = hungerOf(f, now, speed);
  const dead = hunger <= 0;
  return {
    id: f.id,
    grade: gradeOf(f),
    yieldPct: f.yieldPct,
    growthPct: f.growthPct,
    assigned: f.assigned,
    hunger,
    diesAt: dead ? null : diesAt(f.hunger, f.hungerSince, speed),
    dead,
    reviveAura: REVIVE_AURA[gradeOf(f)],
  };
}

/** The Farmers working the Garden, dead ones included (they keep their slot until sent to rest). */
export async function workingFarmers(tx: Conn, address: string) {
  return tx.select().from(farmers).where(and(eq(farmers.address, address), eq(farmers.assigned, true)));
}

/** The working Farmers still alive at `now`: only they add yield and cut growing time. */
export async function gardenFarmers(tx: Conn, address: string, now: number, speed: number) {
  return (await workingFarmers(tx, address)).filter((f) => hungerOf(f, now, speed) > 0);
}

async function view(tx: Conn, address: string, now: number, speed: number, dev: boolean): Promise<FarmersView> {
  const all = await tx.select().from(farmers).where(eq(farmers.address, address)).orderBy(farmers.id);
  const alive = all.filter((f) => f.assigned && hungerOf(f, now, speed) > 0);
  return { farmers: all.map((f) => farmerView(f, now, speed)), slots: FARMER_SLOTS, recruitAura: FARMER_RECRUIT_AURA, bonus: farmerBonus(alive), now, speed, dev };
}

const idParam = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Bad id.');
  return n;
};

async function farmerOf(tx: Conn, address: string, id: number) {
  const [f] = await tx.select().from(farmers).where(and(eq(farmers.id, id), eq(farmers.address, address)));
  if (!f) throw notFound('Farmer');
  return f;
}

/** Store a Farmer's hunger as of `now`: draining from now on while it works, frozen while it rests. */
const setHunger = (tx: Conn, f: Farmer, hunger: number, assigned: boolean, now: number) =>
  tx.update(farmers).set({ assigned, hunger, hungerSince: assigned ? now : null }).where(eq(farmers.id, f.id));

export const farmersRoutes = new Hono<Env>()
  .get('/', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    return c.json(await view(db, c.var.address, now(), speed, devTools));
  })

  // Recruit a Farmer at the Tavern: the $aura burns, the grade and both perks are rolled. It starts full, resting.
  .post('/recruit', async (c) => {
    const { db, random, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const result = await db.transaction(async (tx) => {
      await debit(tx, address, toUnits(FARMER_RECRUIT_AURA), 'tavern:farmer');
      const f = rollFarmer(random(), random(), random());
      const [row] = await tx
        .insert(farmers)
        .values({ address, grade: GRADES.indexOf(f.grade), yieldPct: f.yieldPct, growthPct: f.growthPct })
        .returning();
      const t = now();
      return { farmer: farmerView(row, t, speed), ...(await view(tx, address, t, speed, devTools)) };
    });
    return c.json(result);
  })

  // Put a Farmer to work in the Garden (at most FARMER_SLOTS), or take it off. Hunger drains only while it works.
  .post('/:id/assign', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      if (!f.assigned) {
        if (hungerOf(f, t, speed) <= 0) throw conflict('That Farmer is dead. Revive it first.', 'dead');
        if ((await workingFarmers(tx, address)).length >= FARMER_SLOTS) throw conflict(`The Garden has room for ${FARMER_SLOTS} Farmers.`, 'garden_full');
        await setHunger(tx, f, f.hunger, true, t);
      }
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })
  .post('/:id/unassign', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      if (f.assigned) await setHunger(tx, f, hungerOf(f, t, speed), false, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Feed a Farmer one bread: +BREAD_HUNGER, up to full. Not for a dead Farmer, or one already full.
  .post('/:id/feed', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      const hunger = hungerOf(f, t, speed);
      if (hunger <= 0) throw conflict('That Farmer is dead. Revive it first.', 'dead');
      if (hunger >= HUNGER_FULL) throw conflict('That Farmer is full.', 'full');
      await takeItem(tx, address, 'bread', 1, 'bread');
      await setHunger(tx, f, Math.min(HUNGER_FULL, hunger + BREAD_HUNGER), f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Bring a dead Farmer back for $aura (burned, by grade). It returns with a day's hunger, where it was.
  .post('/:id/revive', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      if (hungerOf(f, t, speed) > 0) throw conflict('That Farmer is alive.', 'alive');
      await debit(tx, address, toUnits(REVIVE_AURA[gradeOf(f)]), 'tavern:revive');
      await setHunger(tx, f, REVIVE_HUNGER, f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Dev only: take DRAIN off a Farmer's hunger, to test warnings, death and revive without waiting.
  .post('/:id/drain', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    if (!devTools) throw notFound('Route');
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      await setHunger(tx, f, Math.max(0, hungerOf(f, t, speed) - DRAIN), f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  });
