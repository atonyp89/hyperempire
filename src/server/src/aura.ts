// $aura from trading: reads the wallet's Hyperliquid fills and credits AURA_PER_USD_FEE per $1 of builder fee,
// once per fill (keyed by trade id). This is the fee indexer, run on demand per wallet.
//
// Known limit: Hyperliquid's fills report a builderFee but not which builder took it, so a fill routed through
// another builder also counts. Reading HyperEmpire's own builder fills will fix that in production.

import { eq } from 'drizzle-orm';
import type { Deps } from './deps';
import { accounts } from './db/schema';
import { credit } from './ledger';
import { AURA_PER_USD_FEE, toUnits } from './rules/aura';

/** Don't re-read Hyperliquid for the same wallet more often than this. */
const SYNC_EVERY_MS = 30_000;
const lastSync = new Map<string, number>();

export async function syncFees(deps: Deps, address: string, force = false): Promise<number> {
  const at = deps.now();
  if (!force && at - (lastSync.get(address) ?? 0) < SYNC_EVERY_MS) return 0;
  lastSync.set(address, at);
  const [acc] = await deps.db.select({ until: accounts.fillsSyncedUntil }).from(accounts).where(eq(accounts.address, address));
  if (!acc) return 0;
  const fills = await deps.fills(address as `0x${string}`, acc.until + 1);
  let credited = 0;
  let newest = acc.until;
  await deps.db.transaction(async (tx) => {
    for (const f of fills) {
      newest = Math.max(newest, f.time);
      const fee = Number(f.builderFee ?? 0);
      if (!(fee > 0)) continue;
      const units = toUnits(fee * AURA_PER_USD_FEE);
      if (await credit(tx, address, units, 'fee', String(f.tid))) credited += units;
    }
    if (newest > acc.until) await tx.update(accounts).set({ fillsSyncedUntil: newest }).where(eq(accounts.address, address));
  });
  return credited;
}
