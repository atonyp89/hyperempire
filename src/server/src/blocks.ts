// Block settlement with lazy catch-up. Every request that touches mining first settles all blocks finished since
// the last settled one, so no timer is needed in the browser; a server worker can call `settle` every 60 s too.
//
// Each block, for every pool: Miners in it that have arrived (readyHeight ≤ block) and have energy mine with
// power = Miner power × Pick multiplier. Shared pools pay out by share of power; rush pools pay the whole share
// to one Miner drawn by power. Simulated power (local and dev only) takes its share like a player who never
// collects. Then energy and durability drain.

import { eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Deps } from './deps';
import { chain, miners, picks, rushWins } from './db/schema';
import { credit } from './ledger';
import { toUnits } from './rules/aura';
import { rows } from './db/migrations';
import { blockHeight, ENERGY_BLOCKS, GRADE, GRADES, MAX_CATCH_UP, minerPower, REWARDS, type Grade, type PoolId } from './rules/mining';

const ENERGY_PER_BLOCK = 100 / ENERGY_BLOCKS;

/** Settle every finished block; returns the last settled height. Safe to call concurrently (row lock). */
export async function settle(deps: Deps): Promise<number> {
  const { db, now, random } = deps;
  const current = blockHeight(now());
  return db.transaction(async (tx) => {
    await tx.insert(chain).values({ id: 1, settledHeight: current - 1 }).onConflictDoNothing();
    const [c] = await tx.execute<{ settled_height: number }>(sql`SELECT settled_height FROM chain WHERE id = 1 FOR UPDATE`).then((r) => rows<{ settled_height: number }>(r));
    const from = Number(c.settled_height) + 1;
    const to = current - 1;
    if (to < from) return Number(c.settled_height);
    const start = Math.max(from, to - MAX_CATCH_UP + 1);

    const working = await tx.select().from(miners).where(isNotNull(miners.pool));
    const pickIds = working.map((m) => m.pickId).filter((id): id is number => id != null);
    const pickRows = pickIds.length ? await tx.select().from(picks).where(inArray(picks.id, pickIds)) : [];
    const pickById = new Map(pickRows.map((p) => [p.id, { ...p }]));
    const state = working.map((m) => ({ ...m }));
    const payouts = new Map<string, number>();
    const pay = (address: string, units: number) => payouts.set(address, (payouts.get(address) ?? 0) + units);

    for (let h = start; h <= to; h++) {
      for (const reward of REWARDS) {
        for (const kind of ['shared', 'rush'] as const) {
          if (kind === 'rush' && !reward.rushEnabled) continue;
          const pool = `${reward.id}:${kind}` as PoolId;
          const prize = toUnits(reward.perBlock * reward.split[kind]);
          const active = state.filter((m) => m.pool === pool && (m.readyHeight ?? 0) <= h && m.energy > 0);
          const powers = active.map((m) => minerPower(GRADES[m.grade] as Grade, m.pickId != null ? toPick(pickById.get(m.pickId)) : null));
          const sim = deps.simulatedPower?.[pool] ?? 0;
          const total = powers.reduce((s, p) => s + p, 0) + sim;
          if (total <= 0) continue;
          if (kind === 'shared') {
            active.forEach((m, i) => pay(m.address, Math.floor((prize * powers[i]) / total)));
          } else {
            let ticket = random() * total;
            const winner = active.find((_, i) => (ticket -= powers[i]) < 0);
            if (winner) pay(winner.address, prize);
            await tx.insert(rushWins).values({ height: h, pool, address: winner?.address ?? null, amount: winner ? prize : 0 }).onConflictDoNothing();
          }
        }
      }
      // Wear: everyone who mined this block uses energy, and their Pick wears.
      for (const m of state) {
        if (!m.pool || (m.readyHeight ?? 0) > h || m.energy <= 0) continue;
        m.energy = Math.max(0, m.energy - ENERGY_PER_BLOCK);
        const p = m.pickId != null ? pickById.get(m.pickId) : undefined;
        if (p && p.durability > 0) p.durability = Math.max(0, p.durability - 100 / pickLife(p.grade));
      }
    }

    for (const m of state) await tx.update(miners).set({ energy: m.energy }).where(eq(miners.id, m.id));
    for (const p of pickById.values()) await tx.update(picks).set({ durability: p.durability }).where(eq(picks.id, p.id));
    for (const [address, units] of payouts) await credit(tx, address, units, 'mine', `${start}-${to}`);
    await tx.update(chain).set({ settledHeight: to }).where(eq(chain.id, 1));
    return to;
  });
}

const pickLife = (grade: number) => GRADE[GRADES[grade] as Grade].pickLife;
const toPick = (p: { grade: number; durability: number } | undefined) => (p ? { grade: GRADES[p.grade] as Grade, durability: p.durability } : null);
