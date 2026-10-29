// The Garden: plant seeds (paid in $gold) in a 4x4 field, let them grow on the clock, and harvest ripe plants
// into the inventory. Plant and harvest take one or many plots at once; each call is all-or-nothing.

import { and, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Conn } from '../db';
import { gardenPlots, inventory } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict } from '../errors';
import { debitGold, goldOf } from '../ledger';
import { CROPS, cropStage, GARDEN_PLOTS, growTime, isCropId, type CropId } from '../rules/garden';
import type { GardenPlotView, GardenView, HarvestResponse } from '../contract';

/** The plots a request names: `slots` (a list) or `slot` (one), each 0-15, no repeats. */
function slotsOf(body: { slot?: unknown; slots?: unknown }): number[] {
  const list = Array.isArray(body.slots) ? body.slots : [body.slot];
  if (!list.length || list.length > GARDEN_PLOTS) throw badRequest(`Name 1 to ${GARDEN_PLOTS} plots.`);
  if (!list.every((s) => Number.isInteger(s) && (s as number) >= 0 && (s as number) < GARDEN_PLOTS)) throw badRequest(`Plots are 0 to ${GARDEN_PLOTS - 1}.`);
  if (new Set(list).size !== list.length) throw badRequest('Each plot only once.');
  return list as number[];
}

async function view(tx: Conn, address: string, now: number, speed: number): Promise<GardenView> {
  const planted = await tx.select().from(gardenPlots).where(eq(gardenPlots.address, address));
  const bySlot = new Map(planted.map((p) => [p.slot, p]));
  const plots = Array.from({ length: GARDEN_PLOTS }, (_, slot): GardenPlotView => {
    const p = bySlot.get(slot);
    if (!p || !isCropId(p.crop)) return { slot, crop: null, plantedAt: null, readyAt: null, stage: 0, ripe: false };
    const crop = CROPS[p.crop];
    const readyAt = p.plantedAt + growTime(crop, speed);
    const stage = cropStage(crop, p.plantedAt, readyAt, now);
    return { slot, crop: crop.id, plantedAt: p.plantedAt, readyAt, stage, ripe: stage === crop.stages - 1 };
  });
  const items = await tx.select().from(inventory).where(eq(inventory.address, address));
  return { now, speed, plots, inventory: Object.fromEntries(items.filter((i) => i.qty > 0).map((i) => [i.item, i.qty])), gold: await goldOf(tx, address) };
}

export const garden = new Hono<Env>()
  .get('/', async (c) => c.json(await view(c.var.deps.db, c.var.address, c.var.deps.now(), c.var.deps.gameSpeed ?? 1)))

  // Plant one crop in each named plot, paying its seed in $gold. Fails if any plot is taken or $gold runs short.
  .post('/plant', async (c) => {
    const { db, now, gameSpeed: speed = 1 } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    if (!isCropId(body.crop)) throw badRequest('Unknown crop.');
    const crop = CROPS[body.crop as CropId];
    const slots = slotsOf(body);
    const t = now();
    const result = await db.transaction(async (tx) => {
      const added = await tx
        .insert(gardenPlots)
        .values(slots.map((slot) => ({ address, slot, crop: crop.id, plantedAt: t })))
        .onConflictDoNothing()
        .returning({ slot: gardenPlots.slot });
      if (added.length !== slots.length) throw conflict('Something is already growing there.', 'plot_taken');
      await debitGold(tx, address, crop.seedGold * slots.length, 'garden:seed');
      return view(tx, address, t, speed);
    });
    return c.json(result);
  })

  // Harvest the named plots: each must be ripe. The plot empties and its crops go to the inventory.
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
        got[crop.id] = (got[crop.id] ?? 0) + crop.yield;
      }
      for (const [item, qty] of Object.entries(got)) {
        await tx
          .insert(inventory)
          .values({ address, item, qty })
          .onConflictDoUpdate({ target: [inventory.address, inventory.item], set: { qty: sql`${inventory.qty} + ${qty}` } });
      }
      return { harvested: got, garden: await view(tx, address, t, speed) };
    });
    return c.json(result);
  });
