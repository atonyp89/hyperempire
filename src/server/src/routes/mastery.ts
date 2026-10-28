// Mastery: each building's level (capped by the Townhall), XP, and its perk tree. Only Exchange Mastery is live;
// the other buildings answer 404 until theirs ships. Rules in rules/mastery.ts.

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Conn } from '../db';
import { masteries } from '../db/schema';
import type { Deps } from '../deps';
import type { Env } from '../env';
import { badRequest, conflict, notFound } from '../errors';
import { debit } from '../ledger';
import { loadMastery } from '../mastery';
import { toUnits } from '../rules/aura';
import { masteryXpBonus, type MasteryId } from '../rules/empire';
import { discountedFeeTenths, feeDiscount, MASTERY_PERKS, masteryPoints, masteryRespecCost } from '../rules/mastery';
import type { MasteryDetail } from '../contract';

const totalRanks = (ranks: Record<string, number>) => Object.values(ranks).reduce((s, r) => s + r, 0);

/** The list-rate builder fee in tenths of a basis point (Hyperliquid's unit). */
const listTenths = (deps: Deps) => Math.round((deps.builder?.feeRate ?? 0) * 100_000);

export async function masteryDetail(deps: Deps, tx: Conn, address: string, building: MasteryId): Promise<MasteryDetail> {
  const m = await loadMastery(tx, address, building);
  const detail: MasteryDetail = {
    building,
    level: m.level,
    uncappedLevel: m.uncapped,
    cap: m.townhallLevel,
    xp: m.xp,
    xpIntoLevel: m.xpIntoLevel,
    xpForNext: m.xpForNext,
    xpBonus: masteryXpBonus(m.townhallLevel),
    points: masteryPoints(m.level) - totalRanks(m.ranks),
    ranks: m.ranks,
    respecCost: masteryRespecCost(m.level, m.respecs),
  };
  if (building === 'exchange') {
    detail.feeDiscount = feeDiscount(m.ranks);
    detail.feeTenthsBps = discountedFeeTenths(listTenths(deps), m.ranks);
  }
  return detail;
}

function liveBuilding(raw: string): MasteryId {
  if (!(raw in MASTERY_PERKS)) throw notFound(`${raw} Mastery`);
  return raw as MasteryId;
}

export const mastery = new Hono<Env>()
  .get('/:building', async (c) => {
    const building = liveBuilding(c.req.param('building'));
    return c.json(await masteryDetail(c.var.deps, c.var.deps.db, c.var.address, building));
  })
  .post('/:building/perks', async (c) => {
    const { deps, address } = c.var;
    const building = liveBuilding(c.req.param('building'));
    const perkId = (await c.req.json().catch(() => ({}))).perkId;
    const perk = MASTERY_PERKS[building]!.find((p) => p.id === perkId);
    if (!perk) throw badRequest('Unknown perk.');
    await deps.db.transaction(async (tx) => {
      const m = await loadMastery(tx, address, building);
      if (masteryPoints(m.level) - totalRanks(m.ranks) < 1) throw conflict('No Mastery points left. Earn XP, and raise your Townhall if Mastery is at its cap.', 'no_points');
      if ((m.ranks[perk.id] ?? 0) >= perk.maxRank) throw conflict('That perk is already at its top rank.', 'max_rank');
      await tx
        .update(masteries)
        .set({ ranks: { ...m.ranks, [perk.id]: (m.ranks[perk.id] ?? 0) + 1 } })
        .where(and(eq(masteries.address, address), eq(masteries.building, building)));
    });
    return c.json(await masteryDetail(deps, deps.db, address, building));
  })
  .post('/:building/respec', async (c) => {
    const { deps, address } = c.var;
    const building = liveBuilding(c.req.param('building'));
    await deps.db.transaction(async (tx) => {
      const m = await loadMastery(tx, address, building);
      if (totalRanks(m.ranks) === 0) throw conflict('There are no perks to reset.', 'nothing_to_reset');
      await debit(tx, address, toUnits(masteryRespecCost(m.level, m.respecs)), `mastery:${building}:respec`);
      await tx
        .update(masteries)
        .set({ ranks: {}, respecs: m.respecs + 1 })
        .where(and(eq(masteries.address, address), eq(masteries.building, building)));
    });
    return c.json(await masteryDetail(deps, deps.db, address, building));
  });
