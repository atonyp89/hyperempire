// Mining: recruit Miners (Tavern), craft and repair Picks (Workshop), merge, feed, equip, and send Miners to the
// Mine's pools. Every route settles finished blocks first, so balances and energy are current.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { settle } from '../blocks';
import type { Conn } from '../db';
import { miners, picks, rushWins } from '../db/schema';
import type { Env } from '../env';
import { badRequest, conflict, notFound } from '../errors';
import { balanceOf, debit } from '../ledger';
import { fromUnits, toUnits } from '../rules/aura';
import {
  BASE_SLOTS,
  blockHeight,
  BLOCK_MS,
  CRAFT_COST,
  FOREMAN_PERK,
  GRADE,
  GRADES,
  isPoolId,
  minerPower,
  nextGrade,
  POOL_IDS,
  RECRUIT_COST,
  REWARDS,
  rollGrade,
  WALK_BLOCKS,
  type Grade,
  type PoolId,
} from '../rules/mining';
import type { MineView, MinerView, PickView, PoolView } from '../contract';
import { loadTownhall } from './townhall';

const BLOCKS_PER_DAY = (24 * 60 * 60_000) / BLOCK_MS;
const gradeOf = (n: number) => GRADES[n] as Grade;
const gradeIndex = (g: Grade) => GRADES.indexOf(g);

async function slots(tx: Conn, address: string) {
  const t = await loadTownhall(tx, address);
  return BASE_SLOTS + (t.ranks[FOREMAN_PERK] ?? 0);
}

async function ownMiner(tx: Conn, address: string, id: number) {
  const [m] = await tx.select().from(miners).where(and(eq(miners.id, id), eq(miners.address, address)));
  if (!m) throw notFound('Miner');
  return m;
}

async function ownPick(tx: Conn, address: string, id: number) {
  const [p] = await tx.select().from(picks).where(and(eq(picks.id, id), eq(picks.address, address)));
  if (!p) throw notFound('Pick');
  return p;
}

const idParam = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Bad id.');
  return n;
};

/** Everything the Mine screen shows: the player's Miners and Picks, and each pool with its numbers. */
async function view(c: { var: Env['Variables'] }): Promise<MineView> {
  const { db, now, simulatedPower } = c.var.deps;
  const address = c.var.address;
  const height = blockHeight(now());
  const working = await db.select().from(miners).where(isNotNull(miners.pool));
  const allPicks = await db.select().from(picks).where(inArray(picks.id, working.map((m) => m.pickId ?? -1).concat(-1)));
  const pickById = new Map(allPicks.map((p) => [p.id, p]));
  const powerOf = (m: (typeof working)[number]) => {
    const p = m.pickId != null ? pickById.get(m.pickId) : undefined;
    return minerPower(gradeOf(m.grade), p ? { grade: gradeOf(p.grade), durability: p.durability } : null);
  };
  const mining = (m: (typeof working)[number]) => m.energy > 0 && (m.readyHeight ?? 0) <= height;

  const pools: PoolView[] = POOL_IDS.map((id) => {
    const [rewardId, kind] = id.split(':') as [string, 'shared' | 'rush'];
    const reward = REWARDS.find((r) => r.id === rewardId)!;
    const prize = reward.perBlock * reward.split[kind];
    const inPool = working.filter((m) => m.pool === id && mining(m));
    const mine = inPool.filter((m) => m.address === address).reduce((s, m) => s + powerOf(m), 0);
    const total = inPool.reduce((s, m) => s + powerOf(m), 0) + (simulatedPower?.[id] ?? 0);
    const share = total > 0 ? mine / total : 0;
    return {
      id,
      reward: reward.name,
      kind,
      perBlock: prize,
      totalPower: total,
      yourPower: mine,
      perThousandPowerPerDay: (prize * BLOCKS_PER_DAY * 1000) / (total + 1000),
      yourPerDay: prize * BLOCKS_PER_DAY * share,
      yourChancePerBlock: kind === 'rush' ? share : null,
    };
  });

  const myMiners = await db.select().from(miners).where(eq(miners.address, address));
  const myPicks = await db.select().from(picks).where(eq(picks.address, address));
  const myPickById = new Map(myPicks.map((p) => [p.id, p]));
  const minerViews: MinerView[] = myMiners.map((m) => {
    const p = m.pickId != null ? myPickById.get(m.pickId) : undefined;
    return {
      id: m.id,
      grade: gradeOf(m.grade),
      energy: m.energy,
      pool: (m.pool as PoolId | null) ?? null,
      walkingBlocks: m.pool && (m.readyHeight ?? 0) > height ? (m.readyHeight ?? 0) - height : 0,
      pickId: m.pickId,
      power: minerPower(gradeOf(m.grade), p ? { grade: gradeOf(p.grade), durability: p.durability } : null),
      feedCost: Math.ceil((GRADE[gradeOf(m.grade)].food * (100 - m.energy)) / 100),
    };
  });
  const pickViews: PickView[] = myPicks.map((p) => ({
    id: p.id,
    grade: gradeOf(p.grade),
    durability: p.durability,
    minerId: myMiners.find((m) => m.pickId === p.id)?.id ?? null,
    repairCost: Math.ceil((GRADE[gradeOf(p.grade)].repair * (100 - p.durability)) / 100),
  }));
  const recent = await db.select().from(rushWins).where(eq(rushWins.address, address)).limit(20);

  return {
    height,
    aura: fromUnits(await balanceOf(db, address)),
    slots: await slots(db, address),
    used: myMiners.filter((m) => m.pool).length,
    pools,
    miners: minerViews,
    picks: pickViews,
    rushWins: recent.map((w) => ({ height: w.height, pool: w.pool as PoolId, amount: fromUnits(w.amount) })),
  };
}

export const mining = new Hono<Env>()
  .use(async (c, next) => {
    await settle(c.var.deps);
    await next();
  })
  .get('/', async (c) => c.json(await view(c)))

  // Tavern: recruit a Miner of a random grade.
  .post('/recruit', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const grade = rollGrade(random());
    const miner = await db.transaction(async (tx) => {
      await debit(tx, address, toUnits(RECRUIT_COST), 'tavern:recruit');
      const [m] = await tx.insert(miners).values({ address, grade: gradeIndex(grade) }).returning();
      return m;
    });
    return c.json({ miner: { id: miner.id, grade }, mine: await view(c) });
  })

  // Merge two idle Miners of one grade: success makes one of the next grade; failure loses both.
  .post('/miners/merge', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    const [a, b] = [idParam(String(body.a)), idParam(String(body.b))];
    if (a === b) throw badRequest('Pick two different Miners.');
    const result = await db.transaction(async (tx) => {
      const [ma, mb] = [await ownMiner(tx, address, a), await ownMiner(tx, address, b)];
      if (ma.grade !== mb.grade) throw conflict('Both Miners must be the same grade.', 'grade_mismatch');
      if (ma.pool || mb.pool) throw conflict('Bring both Miners back from the Mine first.', 'deployed');
      const next = nextGrade(gradeOf(ma.grade));
      if (!next) throw conflict('Legendary Miners can’t be merged.', 'max_grade');
      for (const m of [ma, mb]) if (m.pickId != null) await tx.update(miners).set({ pickId: null }).where(eq(miners.id, m.id));
      await tx.delete(miners).where(inArray(miners.id, [a, b]));
      if (random() >= GRADE[gradeOf(ma.grade)].merge) return { ok: false as const };
      const [m] = await tx.insert(miners).values({ address, grade: gradeIndex(next) }).returning();
      return { ok: true as const, miner: { id: m.id, grade: next } };
    });
    return c.json({ ...result, mine: await view(c) });
  })

  // Feed a Miner back to full energy; the cost scales with how hungry it is.
  .post('/miners/:id/feed', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    await db.transaction(async (tx) => {
      const m = await ownMiner(tx, address, id);
      const cost = Math.ceil((GRADE[gradeOf(m.grade)].food * (100 - m.energy)) / 100);
      if (cost <= 0) throw conflict('That Miner isn’t hungry.', 'full');
      await debit(tx, address, toUnits(cost), 'mine:feed');
      await tx.update(miners).set({ energy: 100 }).where(eq(miners.id, id));
    });
    return c.json(await view(c));
  })

  // Send a Miner to a pool (it walks for WALK_BLOCKS), or bring it home with pool: null.
  .post('/miners/:id/deploy', async (c) => {
    const { db, now } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const pool = (await c.req.json().catch(() => ({}))).pool ?? null;
    if (pool !== null && !isPoolId(pool)) throw badRequest('Unknown pool.');
    await db.transaction(async (tx) => {
      const m = await ownMiner(tx, address, id);
      if (m.pool === pool) return;
      if (pool && !m.pool) {
        const used = (await tx.select({ id: miners.id }).from(miners).where(and(eq(miners.address, address), isNotNull(miners.pool)))).length;
        if (used >= (await slots(tx, address))) throw conflict('All Miner slots are in use. Foreman perks add more.', 'no_slots');
      }
      await tx
        .update(miners)
        .set({ pool, readyHeight: pool ? blockHeight(now()) + WALK_BLOCKS : null })
        .where(eq(miners.id, id));
    });
    return c.json(await view(c));
  })

  // Put a Pick on a Miner (moving it off any other Miner), or take it off with pickId: null.
  .post('/miners/:id/equip', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    const raw = (await c.req.json().catch(() => ({}))).pickId ?? null;
    await db.transaction(async (tx) => {
      await ownMiner(tx, address, id);
      if (raw === null) {
        await tx.update(miners).set({ pickId: null }).where(eq(miners.id, id));
        return;
      }
      const pickId = idParam(String(raw));
      await ownPick(tx, address, pickId);
      await tx.update(miners).set({ pickId: null }).where(and(eq(miners.address, address), eq(miners.pickId, pickId)));
      await tx.update(miners).set({ pickId }).where(eq(miners.id, id));
    });
    return c.json(await view(c));
  })

  // Workshop: craft a Pick of a random grade.
  .post('/craft', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const grade = rollGrade(random());
    const pick = await db.transaction(async (tx) => {
      await debit(tx, address, toUnits(CRAFT_COST), 'workshop:craft');
      const [p] = await tx.insert(picks).values({ address, grade: gradeIndex(grade) }).returning();
      return p;
    });
    return c.json({ pick: { id: pick.id, grade }, mine: await view(c) });
  })

  // Merge two unequipped Picks of one grade, like Miners.
  .post('/picks/merge', async (c) => {
    const { db, random } = c.var.deps;
    const address = c.var.address;
    const body = await c.req.json().catch(() => ({}));
    const [a, b] = [idParam(String(body.a)), idParam(String(body.b))];
    if (a === b) throw badRequest('Pick two different Picks.');
    const result = await db.transaction(async (tx) => {
      const [pa, pb] = [await ownPick(tx, address, a), await ownPick(tx, address, b)];
      if (pa.grade !== pb.grade) throw conflict('Both Picks must be the same grade.', 'grade_mismatch');
      const equipped = await tx.select({ id: miners.id }).from(miners).where(inArray(miners.pickId, [a, b]));
      if (equipped.length) throw conflict('Take both Picks off their Miners first.', 'equipped');
      const next = nextGrade(gradeOf(pa.grade));
      if (!next) throw conflict('Legendary Picks can’t be merged.', 'max_grade');
      await tx.delete(picks).where(inArray(picks.id, [a, b]));
      if (random() >= GRADE[gradeOf(pa.grade)].merge) return { ok: false as const };
      const [p] = await tx.insert(picks).values({ address, grade: gradeIndex(next) }).returning();
      return { ok: true as const, pick: { id: p.id, grade: next } };
    });
    return c.json({ ...result, mine: await view(c) });
  })

  // Repair a Pick to full durability; the cost scales with wear.
  .post('/picks/:id/repair', async (c) => {
    const { db } = c.var.deps;
    const address = c.var.address;
    const id = idParam(c.req.param('id'));
    await db.transaction(async (tx) => {
      const p = await ownPick(tx, address, id);
      const cost = Math.ceil((GRADE[gradeOf(p.grade)].repair * (100 - p.durability)) / 100);
      if (cost <= 0) throw conflict('That Pick doesn’t need repair.', 'full');
      await debit(tx, address, toUnits(cost), 'workshop:repair');
      await tx.update(picks).set({ durability: 100 }).where(eq(picks.id, id));
    });
    return c.json(await view(c));
  });
