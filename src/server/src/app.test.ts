// End-to-end tests of the API on an in-memory PGlite database: real HTTP requests through the Hono app, a real
// wallet signature, a controllable clock and dice. The same flows run against Postgres in production.

import { beforeEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp, type App } from './app';
import { schema, type Db } from './db';
import { migrate } from './db/migrations';
import type { Fill } from './deps';
import { BLOCK_MS, GENESIS, WALK_BLOCKS } from './rules/mining';

const wallet = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

let app: App;
let clock: number;
let dice: number[];
let fills: Fill[];

async function call<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: T }> {
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as T };
}

async function signIn(): Promise<string> {
  const { json: n } = await call('POST', '/auth/nonce', { address: wallet.address });
  const signature = await wallet.signMessage({ message: n.message });
  const { status, json } = await call('POST', '/auth/verify', { address: wallet.address, nonce: n.nonce, signature });
  expect(status).toBe(200);
  return json.token;
}

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(db);
  clock = GENESIS + 1_000 * BLOCK_MS + 10;
  dice = [];
  fills = [];
  app = createApp({
    db,
    network: 'testnet',
    now: () => clock,
    random: () => dice.shift() ?? 0.5,
    fills: async (_a, since) => fills.filter((f) => f.time >= since),
  });
});

describe('auth', () => {
  test('rejects requests without a session, and a wrong signature', async () => {
    expect((await call('GET', '/me')).status).toBe(401);
    const { json: n } = await call('POST', '/auth/nonce', { address: wallet.address });
    const other = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');
    const signature = await other.signMessage({ message: n.message });
    expect((await call('POST', '/auth/verify', { address: wallet.address, nonce: n.nonce, signature })).status).toBe(401);
  });

  test('a signed-in wallet starts with 5,000 $aura', async () => {
    const token = await signIn();
    const { json } = await call('GET', '/me', undefined, token);
    expect(json.address).toBe(wallet.address.toLowerCase());
    expect(json.aura).toBe(5_000);
    expect(json.slots).toBe(3);
  });
});

describe('$aura from fees', () => {
  test('credits 500 $aura per $1 of builder fee, once per fill', async () => {
    const token = await signIn();
    fills = [
      { tid: 1, time: 1, builderFee: '0.5' },
      { tid: 2, time: 2, builderFee: '0' },
    ];
    expect((await call('POST', '/me/sync', undefined, token)).json.credited).toBe(250);
    expect((await call('POST', '/me/sync', undefined, token)).json.credited).toBe(0);
    expect((await call('GET', '/me', undefined, token)).json.aura).toBe(5_250);
  });
});

describe('townhall', () => {
  test('a sure upgrade levels up and burns the full cost', async () => {
    const token = await signIn();
    const { json } = await call('POST', '/townhall/upgrade', { chance: 100 }, token);
    expect(json.ok).toBe(true);
    expect(json.townhall.level).toBe(2);
    expect(json.townhall.aura).toBe(5_000 - 3_031);
  });

  test('a failed risky upgrade still burns its share', async () => {
    const token = await signIn();
    dice = [0.9];
    const { json } = await call('POST', '/townhall/upgrade', { chance: 50 }, token);
    expect(json.ok).toBe(false);
    expect(json.townhall.level).toBe(1);
    expect(json.townhall.aura).toBe(5_000 - 1_516);
  });

  test('perks need points, and respec costs $aura', async () => {
    const token = await signIn();
    expect((await call('POST', '/townhall/perks', { perkId: 'foreman' }, token)).json.ranks.foreman).toBe(1);
    expect((await call('POST', '/townhall/perks', { perkId: 'lower-fees' }, token)).status).toBe(409);
    expect((await call('GET', '/me', undefined, token)).json.slots).toBe(4);
    // A respec at level 1 costs 5,250 $aura: more than the 5,000 starter, until trading adds some.
    expect((await call('POST', '/townhall/respec', undefined, token)).status).toBe(402);
    fills = [{ tid: 9, time: 9, builderFee: '20' }];
    await call('POST', '/me/sync', undefined, token);
    const { json } = await call('POST', '/townhall/respec', undefined, token);
    expect(json.ranks).toEqual({});
    expect(json.aura).toBe(15_000 - 5_250);
  });

  test('spending more than the balance fails with 402', async () => {
    const token = await signIn();
    await call('POST', '/townhall/upgrade', { chance: 100 }, token);
    expect((await call('POST', '/townhall/upgrade', { chance: 100 }, token)).status).toBe(402);
  });
});

describe('mining', () => {
  test('recruit, deploy, walk, then earn from the shared pool and drain energy', async () => {
    const token = await signIn();
    dice = [0.1];
    const { json: r } = await call('POST', '/mine/recruit', undefined, token);
    expect(r.miner.grade).toBe('common');
    expect(r.mine.aura).toBe(4_000);
    await call('POST', `/mine/miners/${r.miner.id}/deploy`, { pool: 'aura:shared' }, token);

    clock += (WALK_BLOCKS + 10) * BLOCK_MS;
    const { json: m } = await call('GET', '/mine', undefined, token);
    // Alone in the pool, it takes the whole 50 $aura of every block it mined after walking.
    expect(m.aura).toBeGreaterThan(4_000);
    expect(m.miners[0].energy).toBeLessThan(100);
    expect(m.pools.find((p: any) => p.id === 'aura:shared').yourPower).toBe(10);
  });

  test('slots limit deployed Miners', async () => {
    const token = await signIn();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) ids.push((await call('POST', '/mine/recruit', undefined, token)).json.miner.id);
    for (const id of ids.slice(0, 3)) expect((await call('POST', `/mine/miners/${id}/deploy`, { pool: 'aura:shared' }, token)).status).toBe(200);
    expect((await call('POST', `/mine/miners/${ids[3]}/deploy`, { pool: 'aura:rush' }, token)).status).toBe(409);
  });

  test('merging two Commons: success makes an Uncommon, failure loses both', async () => {
    const token = await signIn();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) ids.push((await call('POST', '/mine/recruit', undefined, token)).json.miner.id);
    dice = [0.1];
    const win = await call('POST', '/mine/miners/merge', { a: ids[0], b: ids[1] }, token);
    expect(win.json.ok).toBe(true);
    expect(win.json.miner.grade).toBe('uncommon');
    dice = [0.9];
    const lose = await call('POST', '/mine/miners/merge', { a: ids[2], b: ids[3] }, token);
    expect(lose.json.ok).toBe(false);
    expect(lose.json.mine.miners.length).toBe(1);
  });

  test('picks multiply power, wear down, and can be repaired', async () => {
    const token = await signIn();
    const miner = (await call('POST', '/mine/recruit', undefined, token)).json.miner;
    dice = [0.8];
    const pick = (await call('POST', '/mine/craft', undefined, token)).json.pick;
    expect(pick.grade).toBe('uncommon');
    const equipped = (await call('POST', `/mine/miners/${miner.id}/equip`, { pickId: pick.id }, token)).json;
    expect(equipped.miners[0].power).toBe(12.5);
    await call('POST', `/mine/miners/${miner.id}/deploy`, { pool: 'aura:shared' }, token);
    clock += (WALK_BLOCKS + 100) * BLOCK_MS;
    const worn = (await call('GET', '/mine', undefined, token)).json;
    expect(worn.picks[0].durability).toBeLessThan(100);
    expect((await call('POST', `/mine/picks/${pick.id}/repair`, undefined, token)).json.picks[0].durability).toBe(100);
    expect((await call('POST', `/mine/miners/${miner.id}/feed`, undefined, token)).json.miners[0].energy).toBe(100);
  });

  test('rush pools pay the whole share to one winner', async () => {
    const token = await signIn();
    const miner = (await call('POST', '/mine/recruit', undefined, token)).json.miner;
    await call('POST', `/mine/miners/${miner.id}/deploy`, { pool: 'aura:rush' }, token);
    const before = (await call('GET', '/mine', undefined, token)).json.aura;
    clock += (WALK_BLOCKS + 5) * BLOCK_MS;
    const after = (await call('GET', '/mine', undefined, token)).json;
    // Alone in the pool it wins every block it mined: 50 $aura each.
    expect(after.aura - before).toBe(50 * after.rushWins.length);
    expect(after.rushWins.length).toBeGreaterThan(0);
  });
});
