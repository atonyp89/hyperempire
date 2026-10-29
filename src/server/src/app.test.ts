// End-to-end tests of the API on an in-memory PGlite database: real HTTP requests through the Hono app, a real
// wallet signature, a controllable clock and dice. The same flows run against Postgres in production.

import { beforeEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp, type App } from './app';
import { schema, type Db } from './db';
import { migrate } from './db/migrations';
import type { BuilderFill, Deps, Fill } from './deps';
import { DAY_MS, dayOf } from './rules/exchange';
import { BLOCK_MS, GENESIS, WALK_BLOCKS } from './rules/mining';

const ADMIN = { user: 'admin', password: 'correct horse battery' };
const wallet = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const second = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');
const BUILDER = { address: '0x00000000000000000000000000000000000b0b00', feeRate: 0.0005 };

let app: App;
let db: Db;
let clock: number;
let dice: number[];
/** Fake Hyperliquid fills, per lowercase address. */
let fills: Record<string, Fill[]>;
let deps: Deps;

async function call<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: T }> {
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as T };
}

async function signIn(who = wallet): Promise<string> {
  const { json: n } = await call('POST', '/auth/nonce', { address: who.address });
  const signature = await who.signMessage({ message: n.message });
  const { status, json } = await call('POST', '/auth/verify', { address: who.address, nonce: n.nonce, signature });
  expect(status).toBe(200);
  return json.token;
}

beforeEach(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(db);
  clock = GENESIS + 1_000 * BLOCK_MS + 10;
  dice = [];
  fills = {};
  deps = {
    db,
    network: 'testnet',
    now: () => clock,
    random: () => dice.shift() ?? 0.5,
    fills: async (a, since) => (fills[a.toLowerCase()] ?? []).filter((f) => f.time >= since),
    builder: BUILDER,
    admin: ADMIN,
  };
  app = createApp(deps);
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

/** A fill of $100 notional at `fee` USD of builder fee (0.05 = exactly our 0.05% rate). */
const fill = (tid: number, oid: number, time: number, fee = '0.05', px = '100', crossed = true): Fill => ({ tid, oid, time, px, sz: '1', crossed, builderFee: fee });

/** Give `who` $aura through the Exchange: one fill of a reported order, then let the day settle. */
async function earn(token: string, who = wallet, fee = '0.05') {
  const a = who.address.toLowerCase();
  fills[a] = [...(fills[a] ?? []), fill(900 + (fills[a]?.length ?? 0), 77, clock + 1_000, fee)];
  await call('POST', '/exchange/orders', { oids: [77] }, token);
  clock += DAY_MS;
  await call('GET', '/me', undefined, token);
}

describe('exchange rewards (testnet: fills of reported orders)', () => {
  test('only fills of our orders at our rate count, after sign-up; the day settles into the pool', async () => {
    const token = await signIn();
    const a = wallet.address.toLowerCase();
    fills[a] = [
      fill(1, 10, clock + 1_000), // ours
      fill(2, 11, clock + 2_000), // order not placed through our Exchange
      fill(3, 12, clock + 3_000, '0.5'), // 0.5% fee: another builder's rate
      fill(4, 10, clock - 60_000), // before sign-up
    ];
    expect((await call('POST', '/exchange/orders', { oids: [10, 12] }, token)).json.tracked).toBe(2);
    const live = (await call('GET', '/exchange', undefined, token)).json;
    expect(live.yourFees).toBe(0.05);
    expect(live.totalFees).toBe(0.05);
    // Alone today, the whole pool is ours, but only once the day settles.
    expect(live.yourEstimate).toBe(100_000);
    expect(live.pendingAura).toBe(100_000);
    expect((await call('GET', '/me', undefined, token)).json.aura).toBe(5_000);

    clock += DAY_MS;
    const me = (await call('GET', '/me', undefined, token)).json;
    expect(me.aura).toBe(105_000);
    expect(me.pendingAura).toBe(0);
    const after = (await call('GET', '/exchange', undefined, token)).json;
    expect(after.history[0]).toMatchObject({ day: dayOf(clock - DAY_MS), players: 1, totalFees: 0.05, yourFees: 0.05, yourAura: 100_000 });
  });

  test('players split the pool by fees paid', async () => {
    const [ta, tb] = [await signIn(), await signIn(second)];
    fills[wallet.address.toLowerCase()] = [fill(1, 1, clock + 1_000, '0.03')];
    fills[second.address.toLowerCase()] = [fill(2, 2, clock + 1_000, '0.01')];
    await call('POST', '/exchange/orders', { oids: [1] }, ta);
    await call('POST', '/exchange/orders', { oids: [2] }, tb);
    await call('GET', '/exchange', undefined, ta);
    expect((await call('GET', '/exchange', undefined, tb)).json.yourEstimate).toBe(25_000);
    clock += DAY_MS;
    expect((await call('GET', '/me', undefined, ta)).json.aura).toBe(5_000 + 75_000);
    expect((await call('GET', '/me', undefined, tb)).json.aura).toBe(5_000 + 25_000);
  });

  test('order reports are checked', async () => {
    const token = await signIn();
    expect((await call('POST', '/exchange/orders', { oids: [] }, token)).status).toBe(400);
    expect((await call('POST', '/exchange/orders', { oids: [-1] }, token)).status).toBe(400);
    expect((await call('POST', '/exchange/orders', { oids: ['1'] }, token)).status).toBe(400);
    expect((await call('POST', '/exchange/orders', { oids: [1] })).status).toBe(401);
  });
});

describe('exchange rewards (mainnet: daily builder file)', () => {
  let files: Record<string, BuilderFill[] | null>;
  beforeEach(() => {
    files = {};
    app = createApp({ ...deps, network: 'mainnet', builderFills: async (day) => files[day] ?? null });
  });

  test('the file decides: fees to other builders never count, and late sign-ups still get their share', async () => {
    const token = await signIn();
    const day = dayOf(clock);
    // A live fill makes today's estimate, but the file is what pays.
    fills[wallet.address.toLowerCase()] = [fill(1, 5, clock + 1_000)];
    await call('POST', '/exchange/orders', { oids: [5] }, token);
    expect((await call('GET', '/exchange', undefined, token)).json.pendingAura).toBe(100_000);

    // Next day, before the file is published: still pending, nothing credited.
    clock += DAY_MS;
    expect((await call('GET', '/me', undefined, token)).json).toMatchObject({ aura: 5_000, pendingAura: 100_000 });

    // Published: our wallet paid $0.30, someone who hasn't signed up yet paid $0.10.
    files[day] = [
      { time: clock - DAY_MS + 1_000, user: wallet.address.toLowerCase(), feeMicro: 300_000, notionalMicro: 600_000_000, crossed: true },
      { time: clock - DAY_MS + 2_000, user: second.address.toLowerCase(), feeMicro: 100_000, notionalMicro: 200_000_000, crossed: false },
    ];
    clock += 11 * 60_000; // past the retry wait
    expect((await call('GET', '/me', undefined, token)).json).toMatchObject({ aura: 5_000 + 75_000, pendingAura: 0 });

    // The other trader signs up later and gets their share on sign-in.
    const t2 = await signIn(second);
    expect((await call('GET', '/me', undefined, t2)).json.aura).toBe(5_000 + 25_000);
  });

  test('a day whose file never appears settles with no fees after the grace period', async () => {
    const token = await signIn();
    clock += DAY_MS + 37 * 60 * 60_000;
    await call('GET', '/me', undefined, token);
    const overview = (await call('GET', '/exchange', undefined, token)).json;
    expect(overview.history.length).toBeGreaterThan(0);
    expect(overview.history.every((d: any) => d.totalFees === 0)).toBe(true);
  });
});

describe('exchange mastery', () => {
  test('settled fees give XP; the level is capped by the Townhall and counts once it rises', async () => {
    const token = await signIn();
    // $10 of builder fee on a $20k trade: 1,000 XP, +1% from Townhall LV 1.
    fills[wallet.address.toLowerCase()] = [fill(1, 1, clock + 1_000, '10', '20000')];
    await call('POST', '/exchange/orders', { oids: [1] }, token);
    clock += DAY_MS;
    await call('GET', '/me', undefined, token);
    const m = (await call('GET', '/mastery/exchange', undefined, token)).json;
    expect(m).toMatchObject({ xp: 1_010, uncappedLevel: 3, level: 1, cap: 1, points: 1 });
    for (let i = 0; i < 2; i++) await call('POST', '/townhall/upgrade', { chance: 100 }, token);
    const after = (await call('GET', '/mastery/exchange', undefined, token)).json;
    expect(after).toMatchObject({ level: 3, cap: 3, points: 3 });
    expect((await call('GET', '/mastery/garden', undefined, token)).status).toBe(404);
  });

  test('perks spend points, lower the order fee, and respec costs $aura', async () => {
    const token = await signIn();
    expect((await call('POST', '/mastery/exchange/perks', { perkId: 'lower-fees' }, token)).json).toMatchObject({ points: 0, feeDiscount: 0.02, feeTenthsBps: 49 });
    expect((await call('POST', '/mastery/exchange/perks', { perkId: 'taker' }, token)).status).toBe(409);
    expect((await call('POST', '/mastery/exchange/perks', { perkId: 'streak' }, token)).status).toBe(400);
    expect((await call('GET', '/exchange', undefined, token)).json.feeTenthsBps).toBe(49);
    // A respec at Mastery 1 costs 5,250: more than the starter, so trade first.
    expect((await call('POST', '/mastery/exchange/respec', undefined, token)).status).toBe(402);
    await earn(token);
    const r = (await call('POST', '/mastery/exchange/respec', undefined, token)).json;
    expect(r).toMatchObject({ points: 1, ranks: {}, feeTenthsBps: 50 });
    expect((await call('GET', '/me', undefined, token)).json.aura).toBe(105_000 - 5_250);
  });

  test('style perks add pool weight: a Taker splits an equal day 1.03 : 1', async () => {
    const [ta, tb] = [await signIn(), await signIn(second)];
    await call('POST', '/mastery/exchange/perks', { perkId: 'taker' }, ta);
    fills[wallet.address.toLowerCase()] = [fill(1, 1, clock + 1_000)];
    fills[second.address.toLowerCase()] = [fill(2, 2, clock + 1_000)];
    await call('POST', '/exchange/orders', { oids: [1] }, ta);
    await call('POST', '/exchange/orders', { oids: [2] }, tb);
    await call('GET', '/exchange', undefined, tb);
    expect((await call('GET', '/exchange', undefined, ta)).json.yourEstimate).toBeCloseTo((100_000 * 1.03) / 2.03, 3);
    clock += DAY_MS;
    expect((await call('GET', '/me', undefined, ta)).json.aura).toBeCloseTo(5_000 + (100_000 * 1.03) / 2.03, 0);
    expect((await call('GET', '/me', undefined, tb)).json.aura).toBeCloseTo(5_000 + 100_000 / 2.03, 0);
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

  test('the level caps every Mastery and adds Mastery XP; Townhall perks and respec are gone', async () => {
    const token = await signIn();
    const { json } = await call('GET', '/townhall', undefined, token);
    expect(json).toMatchObject({ level: 1, masteryCap: 1, masteryXpBonus: 0.01 });
    await earn(token);
    const up = (await call('POST', '/townhall/upgrade', { chance: 100 }, token)).json.townhall;
    expect(up).toMatchObject({ level: 2, masteryCap: 2, masteryXpBonus: 0.02 });
    expect((await call('POST', '/townhall/perks', { perkId: 'foreman' }, token)).status).toBe(404);
    expect((await call('POST', '/townhall/respec', undefined, token)).status).toBe(404);
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

describe('gold', () => {
  test('starts at 0; the faucet is off unless Deps turns it on', async () => {
    const token = await signIn();
    expect((await call('GET', '/me', undefined, token)).json.gold).toBe(0);
    expect((await call('GET', '/gold', undefined, token)).json).toEqual({ gold: 0, faucet: null });
    expect((await call('POST', '/gold/faucet', undefined, token)).status).toBe(404);
    expect((await call('GET', '/gold')).status).toBe(401);
  });

  test('each faucet claim adds $gold to its own balance and ledger rows, leaving $aura alone', async () => {
    app = createApp({ ...deps, goldFaucet: 1_000 });
    const token = await signIn();
    expect((await call('POST', '/gold/faucet', undefined, token)).json).toEqual({ gold: 1_000, faucet: 1_000 });
    expect((await call('POST', '/gold/faucet', undefined, token)).json.gold).toBe(2_000);
    const me = (await call('GET', '/me', undefined, token)).json;
    expect([me.gold, me.aura]).toEqual([2_000, 5_000]);
    const rows = await db.select().from(schema.ledger);
    expect(rows.filter((r) => r.currency === 'gold').map((r) => [r.kind, r.delta])).toEqual([['faucet', 1_000], ['faucet', 1_000]]);
    expect(rows.filter((r) => r.currency === 'aura').map((r) => r.kind)).toEqual(['starter']);
  });
});

describe('garden', () => {
  const MIN = 60_000;
  const withGold = async () => {
    app = createApp({ ...deps, goldFaucet: 100 });
    const token = await signIn();
    await call('POST', '/gold/faucet', undefined, token);
    return token;
  };

  test('16 empty plots; planting costs seed $gold and the crop grows through its stages', async () => {
    const token = await withGold();
    const empty = (await call('GET', '/garden', undefined, token)).json;
    expect(empty.plots).toHaveLength(16);
    expect(empty.plots.every((p: any) => p.crop === null)).toBe(true);

    const planted = await call('POST', '/garden/plant', { crop: 'wheat', slots: [0, 5] }, token);
    expect(planted.status).toBe(200);
    expect(planted.json.gold).toBe(80);
    expect(planted.json.plots[5]).toMatchObject({ crop: 'wheat', stage: 0, ripe: false, readyAt: clock + 3 * MIN });

    const stages = [];
    for (const dt of [MIN, MIN, MIN]) {
      clock += dt;
      stages.push((await call('GET', '/garden', undefined, token)).json.plots[0].stage);
    }
    expect(stages).toEqual([1, 2, 3]);
  });

  test('harvest needs a ripe plant, then empties the plot and fills the inventory', async () => {
    const token = await withGold();
    await call('POST', '/garden/plant', { crop: 'wheat', slots: [3, 4] }, token);
    const early = await call('POST', '/garden/harvest', { slot: 3 }, token);
    expect([early.status, early.json.error]).toEqual([409, 'not_ripe']);

    clock += 3 * MIN;
    const { status, json } = await call('POST', '/garden/harvest', { slots: [3, 4] }, token);
    expect(status).toBe(200);
    expect(json.harvested).toEqual({ wheat: 6 });
    expect(json.garden.inventory).toEqual({ wheat: 6 });
    expect(json.garden.plots[3].crop).toBeNull();
    expect((await call('POST', '/garden/harvest', { slot: 3 }, token)).json.error).toBe('plot_empty');
  });

  test('plots, crops and $gold are checked, all or nothing', async () => {
    const token = await withGold();
    await call('POST', '/garden/plant', { crop: 'wheat', slot: 1 }, token);
    const taken = await call('POST', '/garden/plant', { crop: 'wheat', slots: [1, 2] }, token);
    expect([taken.status, taken.json.error]).toEqual([409, 'plot_taken']);
    expect((await call('GET', '/garden', undefined, token)).json.plots[2].crop).toBeNull();
    expect((await call('POST', '/garden/plant', { crop: 'rose', slot: 2 }, token)).status).toBe(400);
    expect((await call('POST', '/garden/plant', { crop: 'wheat', slot: 16 }, token)).status).toBe(400);
    expect((await call('POST', '/garden/plant', { crop: 'wheat', slots: [2, 2] }, token)).status).toBe(400);
    const broke = await call('POST', '/garden/plant', { crop: 'wheat', slots: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, token);
    expect([broke.status, broke.json.error]).toEqual([402, 'not_enough_gold']);
    expect((await call('GET', '/garden', undefined, token)).json.plots.filter((p: any) => p.crop)).toHaveLength(1);
  });
});

describe('admin', () => {
  const basic = (user: string, password: string, ip?: string) => ({
    authorization: `Basic ${btoa(`${user}:${password}`)}`,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
  });
  const adminCall = async (method: string, path: string, body?: unknown, headers = basic(ADMIN.user, ADMIN.password)) => {
    const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as any };
  };

  test('is off without credentials, and needs the right username and password', async () => {
    const off = createApp({ db, network: 'testnet', now: () => clock, random: Math.random, fills: async () => [] });
    expect((await off.request('/admin/overview', { headers: basic(ADMIN.user, ADMIN.password) })).status).toBe(404);
    const short = createApp({ db, network: 'testnet', now: () => clock, random: Math.random, fills: async () => [], admin: { user: 'a', password: 'short' } });
    expect((await short.request('/admin/overview', { headers: basic('a', 'short') })).status).toBe(404);
    expect((await app.request('/admin/overview')).status).toBe(401);
    expect((await adminCall('GET', '/admin/overview', undefined, basic('admin', 'wrong'))).status).toBe(401);
    expect((await adminCall('GET', '/admin/overview', undefined, basic('root', ADMIN.password))).status).toBe(401);
    // A player's session token doesn't open it either.
    const token = await signIn();
    expect((await app.request('/admin/overview', { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
  });

  test('overview: tables, row counts, $aura totals and $gold supply', async () => {
    app = createApp({ ...deps, goldFaucet: 250 });
    await call('POST', '/gold/faucet', undefined, await signIn());
    const { status, json } = await adminCall('GET', '/admin/overview');
    expect(status).toBe(200);
    const accounts = json.tables.find((t: any) => t.name === 'accounts');
    expect(accounts.rows).toBe(1);
    expect(accounts.columns.map((c: any) => c.name)).toContain('balance');
    expect(json.auraSupply).toBe(5_000);
    expect(json.goldSupply).toBe(250);
    expect(json.ledgerByKind).toEqual([{ kind: 'starter', total: 5_000, entries: 1 }]);
  });

  test('table rows page, sort, and reject unknown tables', async () => {
    const token = await signIn();
    for (let i = 0; i < 3; i++) await call('POST', '/mine/recruit', undefined, token);
    const page = await adminCall('GET', '/admin/tables/miners?limit=2&order=id&dir=asc');
    expect(page.json.total).toBe(3);
    expect(page.json.rows.map((r: any) => r.id)).toEqual([1, 2]);
    // An unknown sort column falls back to the first column instead of reaching the SQL.
    expect((await adminCall('GET', '/admin/tables/miners?order=id;DROP%20TABLE%20miners')).status).toBe(200);
    expect((await adminCall('GET', '/admin/tables/pg_user')).status).toBe(404);
  });

  test('queries are read-only, one statement at a time', async () => {
    await signIn();
    const ok = await adminCall('POST', '/admin/query', { sql: 'SELECT address, balance FROM accounts' });
    expect(ok.status).toBe(200);
    expect(ok.json.columns).toEqual(['address', 'balance']);
    expect(ok.json.rows[0].balance).toBe(5_000_000);
    for (const bad of ['UPDATE accounts SET balance = 0', 'DELETE FROM ledger', 'DROP TABLE accounts', 'SET TRANSACTION READ WRITE', 'SELECT 1; DELETE FROM ledger', 'WITH d AS (DELETE FROM ledger RETURNING *) SELECT count(*) FROM d', 'COMMIT']) {
      const r = await adminCall('POST', '/admin/query', { sql: bad });
      expect(r.status).toBe(400);
    }
    expect((await adminCall('POST', '/admin/query', { sql: 'SELECT sum(balance)::int AS s FROM accounts' })).json.rows[0].s).toBe(5_000_000);
  });

  test('locks a client out after 10 wrong passwords', async () => {
    for (let i = 0; i < 10; i++) expect((await adminCall('GET', '/admin/overview', undefined, basic('admin', 'nope', '9.9.9.9'))).status).toBe(401);
    expect((await adminCall('GET', '/admin/overview', undefined, basic(ADMIN.user, ADMIN.password, '9.9.9.9'))).status).toBe(429);
    clock += 16 * 60_000;
    expect((await adminCall('GET', '/admin/overview', undefined, basic(ADMIN.user, ADMIN.password, '9.9.9.9'))).status).toBe(200);
  });
});
