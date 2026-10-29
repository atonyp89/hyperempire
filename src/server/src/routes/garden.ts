// The Garden: buy seed packs with $gold, open them into 10 seeds of random grades, plant seeds in a 4x4 field, let
// them grow on the clock, and harvest ripe plants into the inventory (better seeds yield more). Plant and harvest
// take one or many plots at once; each call is all-or-nothing.

import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Conn } from '../db';
import { gardenPlots } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict } from '../errors';
import { addItem, itemsOf, takeItem } from '../inventory';
import { debitGold, goldOf } from '../ledger';
import { CROPS, cropStage, GARDEN_PLOTS, growTime, isCropId, MAX_PACKS, PACK_SEEDS, packGold, packItem, parseSeed, seedItem, yieldOf, type Crop, type CropId } from '../rules/garden';
import { GRADES, rollGrade, type Grade } from '../rules/mining';
import type { GardenPlotView, GardenView, HarvestResponse, OpenPacksResponse } from '../contract';

/** The plots a request names: `slots` (a list) or `slot` (one), each 0-15, no repeats. */
function slotsOf(body: { slot?: unknown; slots?: unknown }): number[] {
  const list = Array.isArray(body.slots) ? body.slots : [body.slot];
  if (!list.length || list.length > GARDEN_PLOTS) throw badRequest(`Name 1 to ${GARDEN_PLOTS} plots.`);
  if (!list.every((s) => Number.isInteger(s) && (s as number) >= 0 && (s as number) < GARDEN_PLOTS)) throw badRequest(`Plots are 0 to ${GARDEN_PLOTS - 1}.`);
  if (new Set(list).size !== list.length) throw badRequest('Each plot only once.');
  return list as number[];
}

/** A pack count from the body: 1 to MAX_PACKS, 1 when left out. */
function packsOf(body: { qty?: unknown }): number {
  const qty = body.qty ?? 1;
  if (!Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > MAX_PACKS) throw badRequest(`1 to ${MAX_PACKS} packs at a time.`);
  return qty as number;
}

const cropOf = (body: { crop?: unknown }): CropId => {
  if (!isCropId(body.crop)) throw badRequest('Unknown crop.');
  return body.crop;
};

const gradeOf = (n: number): Grade => GRADES[n] ?? 'common';

/** Open `qty` packs of a crop already in the inventory: PACK_SEEDS seeds each, every one rolling its own grade. */
async function openPacks(tx: Conn, address: string, crop: Crop, qty: number, random: () => number): Promise<string[]> {
  await takeItem(tx, address, packItem(crop.id), qty, crop.packName + 's');
  const opened = Array.from({ length: qty * PACK_SEEDS }, () => seedItem(crop.id, rollGrade(random())));
  const counts = new Map<string, number>();
  for (const id of opened) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) await addItem(tx, address, id, n);
  return opened;
}

async function view(tx: Conn, address: string, now: number, speed: number): Promise<GardenView> {
  const planted = await tx.select().from(gardenPlots).where(eq(gardenPlots.address, address));
  const bySlot = new Map(planted.map((p) => [p.slot, p]));
  const plots = Array.from({ length: GARDEN_PLOTS }, (_, slot): GardenPlotView => {
    const p = bySlot.get(slot);
    if (!p || !isCropId(p.crop)) return { slot, crop: null, grade: null, plantedAt: null, readyAt: null, stage: 0, ripe: false };
    const crop = CROPS[p.crop];
    const readyAt = p.plantedAt + growTime(crop, speed);
    const stage = cropStage(crop, p.plantedAt, readyAt, now);
    return { slot, crop: crop.id, grade: gradeOf(p.grade), plantedAt: p.plantedAt, readyAt, stage, ripe: stage === crop.stages - 1 };
  });
  return { now, speed, plots, inventory: await itemsOf(tx, address), gold: await goldOf(tx, address) };
}

export const garden = new Hono<Env>()
  .get('/', async (c) => c.json(await view(c.var.deps.db, c.var.address, c.var.deps.now(), c.var.deps.gameSpeed ?? 1)))

  // Buy `qty` packs of a crop's seeds with $gold, into the inventory. With `open: true` they open straight away
  // (the shop does this) and the answer lists the seeds, like POST /open.
  .post('/buy', async (c) => {
    const { db, now, random, gameSpeed: speed = 1 } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    const crop = CROPS[cropOf(body)];
    const qty = packsOf(body);
    const result = await db.transaction(async (tx) => {
      await debitGold(tx, address, packGold(crop) * qty, 'garden:pack');
      await addItem(tx, address, packItem(crop.id), qty);
      const opened = body.open === true ? await openPacks(tx, address, crop, qty, random) : null;
      const garden = await view(tx, address, now(), speed);
      return opened ? ({ opened, garden } satisfies OpenPacksResponse) : garden;
    });
    return c.json(result);
  })

  // Open `qty` packs of a crop: each gives PACK_SEEDS seeds, every one rolling its grade on its own.
  .post('/open', async (c) => {
    const { db, now, random, gameSpeed: speed = 1 } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    const crop = CROPS[cropOf(body)];
    const qty = packsOf(body);
    const result = await db.transaction(async (tx): Promise<OpenPacksResponse> => {
      const opened = await openPacks(tx, address, crop, qty, random);
      return { opened, garden: await view(tx, address, now(), speed) };
    });
    return c.json(result);
  })

  // Plant one `seed` (an inventory item such as "wheat-seed:rare") in each named plot. Fails if any plot is taken or
  // seeds run short.
  .post('/plant', async (c) => {
    const { db, now, gameSpeed: speed = 1 } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    const seed = typeof body.seed === 'string' ? parseSeed(body.seed) : null;
    if (!seed) throw badRequest('Unknown seed.');
    const crop = CROPS[seed.crop];
    const slots = slotsOf(body);
    const t = now();
    const result = await db.transaction(async (tx) => {
      const added = await tx
        .insert(gardenPlots)
        .values(slots.map((slot) => ({ address, slot, crop: crop.id, grade: GRADES.indexOf(seed.grade), plantedAt: t })))
        .onConflictDoNothing()
        .returning({ slot: gardenPlots.slot });
      if (added.length !== slots.length) throw conflict('Something is already growing there.', 'plot_taken');
      await takeItem(tx, address, seedItem(crop.id, seed.grade), slots.length, `${seed.grade} ${crop.seedName.toLowerCase()}s`);
      return view(tx, address, t, speed);
    });
    return c.json(result);
  })

  // Harvest the named plots: each must be ripe. The plot empties and its crops (by seed grade) go to the inventory.
  .post('/harvest', async (c) => {
    const { db, now, gameSpeed: speed = 1 } = c.var.deps;
    const address = c.var.address;
    const slots = slotsOf(await c.req.json().catch(() => ({})));
    const t = now();
    const result = await db.transaction(async (tx): Promise<HarvestResponse> => {
      const rows = await tx
        .delete(gardenPlots)
        .where(and(eq(gardenPlots.address, address), inArray(gardenPlots.slot, slots)))
        .returning();
      if (rows.length !== slots.length) throw conflict('Nothing is growing there.', 'plot_empty');
      const got: Record<string, number> = {};
      for (const p of rows) {
        if (!isCropId(p.crop)) throw conflict('Unknown crop in that plot.', 'plot_empty');
        const crop = CROPS[p.crop];
        if (cropStage(crop, p.plantedAt, p.plantedAt + growTime(crop, speed), t) < crop.stages - 1) throw conflict(`${crop.name} isn’t ripe yet.`, 'not_ripe');
        got[crop.id] = (got[crop.id] ?? 0) + yieldOf(crop, gradeOf(p.grade));
      }
      for (const [item, qty] of Object.entries(got)) await addItem(tx, address, item, qty);
      return { harvested: got, garden: await view(tx, address, t, speed) };
    });
    return c.json(result);
  });
