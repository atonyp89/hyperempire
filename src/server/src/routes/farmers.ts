// Farmers: recruit at the Tavern for $aura (a random grade and two perks rolled in its range), and put up to 3 to
// work the Garden, where their perks add yield and cut growing time. Working Farmers get hungry and lose happiness:
// bread feeds them, and one that reaches 0 hunger dies, adding nothing until $aura revives it; wine cheers them up,
// and an unhappy one gives half its perks, a miserable one none. Resting Farmers don't change.

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
import {
  BREAD_HUNGER,
  diesAt,
  happinessAt,
  HAPPINESS_FULL,
  HUNGER_FULL,
  hungerAt,
  moodOf,
  MOOD_PERKS,
  REVIVE_AURA,
  REVIVE_HAPPINESS,
  REVIVE_HUNGER,
  WINE_HAPPINESS,
} from '../rules/food';
import { GRADES, type Grade } from '../rules/mining';

type Farmer = typeof farmers.$inferSelect;
type Stats = { hunger: number; happiness: number };

/** Hunger and happiness a dev drain takes off. */
const DRAIN = 25;

const gradeOf = (f: Farmer) => (GRADES[f.grade] ?? 'common') as Grade;
const statsOf = (f: Farmer, now: number, speed: number): Stats => ({
  hunger: hungerAt(f.hunger, f.statsSince, now, speed),
  happiness: happinessAt(f.happiness, f.statsSince, now, speed),
});

export function farmerView(f: Farmer, now: number, speed: number): FarmerView {
  const { hunger, happiness } = statsOf(f, now, speed);
  const dead = hunger <= 0;
  const mood = moodOf(happiness);
  return {
    id: f.id,
    grade: gradeOf(f),
    yieldPct: f.yieldPct,
    growthPct: f.growthPct,
    assigned: f.assigned,
    hunger,
    happiness,
    mood,
    perkScale: dead ? 0 : MOOD_PERKS[mood],
    diesAt: dead ? null : diesAt(f.hunger, f.statsSince, speed),
    dead,
    reviveAura: REVIVE_AURA[gradeOf(f)],
  };
}

/** The Farmers working the Garden, dead ones included (they keep their slot until sent to rest). */
export async function workingFarmers(tx: Conn, address: string) {
  return tx.select().from(farmers).where(and(eq(farmers.address, address), eq(farmers.assigned, true)));
}

/** What the working Farmers add at `now`: each counts by its mood, and dead ones not at all. */
export async function gardenBonus(tx: Conn, address: string, now: number, speed: number) {
  return farmerBonus((await workingFarmers(tx, address)).map((f) => ({ ...f, scale: farmerView(f, now, speed).perkScale })));
}

async function view(tx: Conn, address: string, now: number, speed: number, dev: boolean): Promise<FarmersView> {
  const all = await tx.select().from(farmers).where(eq(farmers.address, address)).orderBy(farmers.id);
  const views = all.map((f) => farmerView(f, now, speed));
  const bonus = farmerBonus(views.filter((f) => f.assigned).map((f) => ({ ...f, scale: f.perkScale })));
  return { farmers: views, slots: FARMER_SLOTS, recruitAura: FARMER_RECRUIT_AURA, bonus, now, speed, dev };
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

/** Store a Farmer's hunger and happiness as of `now`: draining from now on while it works, frozen while it rests. */
const setStats = (tx: Conn, f: Farmer, s: Stats, assigned: boolean, now: number) =>
  tx.update(farmers).set({ assigned, hunger: s.hunger, happiness: s.happiness, statsSince: assigned ? now : null }).where(eq(farmers.id, f.id));

/** What a Farmer can be given: bread fills hunger, wine raises happiness. */
const GIFTS = {
  bread: { stat: 'hunger', amount: BREAD_HUNGER, full: HUNGER_FULL, fullMessage: 'That Farmer is full.' },
  wine: { stat: 'happiness', amount: WINE_HAPPINESS, full: HAPPINESS_FULL, fullMessage: 'That Farmer is as happy as can be.' },
} as const;
const isGift = (v: unknown): v is keyof typeof GIFTS => typeof v === 'string' && Object.hasOwn(GIFTS, v);

export const farmersRoutes = new Hono<Env>()
  .get('/', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    return c.json(await view(db, c.var.address, now(), speed, devTools));
  })

  // Recruit a Farmer at the Tavern: the $aura burns, the grade and both perks are rolled. It starts full and happy,
  // resting.
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

  // Put a Farmer to work in the Garden (at most FARMER_SLOTS), or take it off. Its stats drain only while it works.
  .post('/:id/assign', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      if (!f.assigned) {
        if (f.hunger <= 0) throw conflict('That Farmer is dead. Revive it first.', 'dead');
        if ((await workingFarmers(tx, address)).length >= FARMER_SLOTS) throw conflict(`The Garden has room for ${FARMER_SLOTS} Farmers.`, 'garden_full');
        await setStats(tx, f, f, true, t);
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
      if (f.assigned) await setStats(tx, f, statsOf(f, t, speed), false, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Give a Farmer one `item`: bread (+BREAD_HUNGER) or wine (+WINE_HAPPINESS), up to full. Bread is the default.
  // Not for a dead Farmer, or one already full on that stat.
  .post('/:id/feed', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const item: unknown = body.item ?? 'bread';
    if (!isGift(item)) throw badRequest('Farmers take bread or wine.');
    const gift = GIFTS[item];
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      const stats = statsOf(f, t, speed);
      if (stats.hunger <= 0) throw conflict('That Farmer is dead. Revive it first.', 'dead');
      if (stats[gift.stat] >= gift.full) throw conflict(gift.fullMessage, 'full');
      await takeItem(tx, address, item, 1, item);
      await setStats(tx, f, { ...stats, [gift.stat]: Math.min(gift.full, stats[gift.stat] + gift.amount) }, f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Bring a dead Farmer back for $aura (burned, by grade). It returns with a day's hunger, just happy, where it was.
  .post('/:id/revive', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      if (statsOf(f, t, speed).hunger > 0) throw conflict('That Farmer is alive.', 'alive');
      await debit(tx, address, toUnits(REVIVE_AURA[gradeOf(f)]), 'tavern:revive');
      await setStats(tx, f, { hunger: REVIVE_HUNGER, happiness: REVIVE_HAPPINESS }, f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  })

  // Dev only: take DRAIN off a Farmer's `stat` (hunger or happiness; hunger by default), to test warnings, moods,
  // death and revive without waiting.
  .post('/:id/drain', async (c) => {
    const { db, now, gameSpeed: speed = 1, devTools = false } = c.var.deps;
    if (!devTools) throw notFound('Route');
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const stat = body.stat ?? 'hunger';
    if (stat !== 'hunger' && stat !== 'happiness') throw badRequest('Drain hunger or happiness.');
    const t = now();
    const result = await db.transaction(async (tx) => {
      const f = await farmerOf(tx, address, id);
      const stats = statsOf(f, t, speed);
      await setStats(tx, f, { ...stats, [stat]: Math.max(0, stats[stat as keyof Stats] - DRAIN) }, f.assigned, t);
      return view(tx, address, t, speed, devTools);
    });
    return c.json(result);
  });
