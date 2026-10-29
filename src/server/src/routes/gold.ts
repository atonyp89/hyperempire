// $gold: the balance, and a faucet for testing. The faucet only exists where Deps turns it on (local development
// and testnet servers), never on mainnet in production.

import { Hono } from 'hono';
import type { GoldView } from '../contract';
import type { Env } from '../env';
import { notFound } from '../errors';
import { creditGold, goldOf } from '../ledger';

export const gold = new Hono<Env>()
  .get('/', async (c) => {
    const { deps, address } = c.var;
    return c.json<GoldView>({ gold: await goldOf(deps.db, address), faucet: deps.goldFaucet ?? null });
  })
  .post('/faucet', async (c) => {
    const { deps, address } = c.var;
    if (!deps.goldFaucet) throw notFound('Faucet');
    const amount = deps.goldFaucet;
    const body = await deps.db.transaction(async (tx) => {
      await creditGold(tx, address, amount, 'faucet');
      return { gold: await goldOf(tx, address), faucet: amount };
    });
    return c.json<GoldView>(body);
  });
