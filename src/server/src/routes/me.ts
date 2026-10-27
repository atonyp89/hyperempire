// The signed-in player: $aura balance (after syncing new trading fees) and Townhall basics.

import { Hono } from 'hono';
import { syncFees } from '../aura';
import { settle } from '../blocks';
import type { MeView } from '../contract';
import type { Env } from '../env';
import { balanceOf } from '../ledger';
import { fromUnits } from '../rules/aura';
import { BASE_SLOTS, FOREMAN_PERK } from '../rules/mining';
import { loadTownhall } from './townhall';

export const me = new Hono<Env>()
  .get('/', async (c) => {
    const { deps, address } = c.var;
    await settle(deps);
    const synced = await syncFees(deps, address).catch(() => 0);
    const t = await loadTownhall(deps.db, address);
    const body: MeView = {
      address,
      aura: fromUnits(await balanceOf(deps.db, address)),
      level: t.level,
      slots: BASE_SLOTS + (t.ranks[FOREMAN_PERK] ?? 0),
      synced: fromUnits(synced),
    };
    return c.json(body);
  })
  .post('/sync', async (c) => {
    const credited = await syncFees(c.var.deps, c.var.address, true);
    return c.json({ credited: fromUnits(credited) });
  });
