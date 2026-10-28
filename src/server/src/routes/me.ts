// The signed-in player: $aura balance (after settling finished Exchange days) and Townhall basics.

import { Hono } from 'hono';
import { exchangeView, settleDays, syncFills } from '../exchange';
import { settle } from '../blocks';
import type { MeView } from '../contract';
import type { Env } from '../env';
import { balanceOf } from '../ledger';
import { fromUnits } from '../rules/aura';
import { BASE_SLOTS } from '../rules/mining';
import { loadTownhall } from './townhall';

export const me = new Hono<Env>()
  .get('/', async (c) => {
    const { deps, address } = c.var;
    await settle(deps);
    await syncFills(deps, address).catch(() => 0);
    await settleDays(deps).catch((err) => console.error('[exchange]', err));
    const t = await loadTownhall(deps.db, address);
    const body: MeView = {
      address,
      aura: fromUnits(await balanceOf(deps.db, address)),
      level: t.level,
      slots: BASE_SLOTS,
      pendingAura: (await exchangeView(deps, address)).pendingAura,
    };
    return c.json(body);
  })
  .post('/sync', async (c) => {
    const fills = await syncFills(c.var.deps, c.var.address, true);
    await settleDays(c.var.deps);
    return c.json({ fills });
  });
