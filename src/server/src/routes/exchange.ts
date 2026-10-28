// Exchange rewards: report orders placed through our Exchange, and see today's pool and your share.

import { Hono } from 'hono';
import type { Env } from '../env';
import { badRequest } from '../errors';
import { exchangeView, MAX_ORDERS, settleDays, syncFills, trackOrders } from '../exchange';

export const exchange = new Hono<Env>()
  .get('/', async (c) => {
    const { deps, address } = c.var;
    await syncFills(deps, address).catch(() => 0);
    await settleDays(deps);
    return c.json(await exchangeView(deps, address));
  })
  .post('/orders', async (c) => {
    const raw = (await c.req.json().catch(() => ({}))).oids;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ORDERS || !raw.every((o) => Number.isSafeInteger(o) && o > 0)) {
      throw badRequest(`Send 1–${MAX_ORDERS} order ids.`);
    }
    return c.json({ tracked: await trackOrders(c.var.deps, c.var.address, raw as number[]) });
  });
