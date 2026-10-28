// The API contract: request and response shapes, plus the game rules the client draws from. This is the only
// server module the web app imports (besides local.ts, which runs the server in the browser), so the two stay
// in step and the web app never reaches into server internals.

import type { Grade, PoolId, PoolKind } from './rules/mining';

export * from './rules/empire';
export { DAILY_EMISSION, marginalShare } from './rules/exchange';
export { GRADES, GRADE, RECRUIT_COST, CRAFT_COST, BASE_SLOTS, WALK_BLOCKS, ENERGY_BLOCKS, BLOCK_MS, REWARDS } from './rules/mining';
export type { Grade, PoolId, PoolKind, RewardConfig, RewardId } from './rules/mining';

export type ApiErrorBody = { error: string; message: string };

export type NonceResponse = { nonce: string; message: string };
export type SessionResponse = { token: string; address: string; expiresAt: number };

export type MeView = { address: string; aura: number; level: number; slots: number; /** Exchange $aura not settled yet. */ pendingAura: number };

export type TownhallView = {
  level: number;
  ranks: Record<string, number>;
  respecs: number;
  aura: number;
  nextCost: number;
  points: number;
  respecCost: number;
};
export type UpgradeResponse = { ok: boolean; spent: number; chance: number; townhall: TownhallView };

export type PoolView = {
  id: PoolId;
  reward: string;
  kind: PoolKind;
  /** This pool's reward per block. */
  perBlock: number;
  /** Power mining here right now (including simulated players in development). */
  totalPower: number;
  yourPower: number;
  /** What 1,000 more power would earn here per day, at today's total. */
  perThousandPowerPerDay: number;
  /** Your expected earnings per day here (for rush pools, on average). */
  yourPerDay: number;
  /** Rush pools: your chance to win each block. */
  yourChancePerBlock: number | null;
};

export type MinerView = {
  id: number;
  grade: Grade;
  energy: number;
  pool: PoolId | null;
  /** Blocks until it reaches its pool and starts mining. */
  walkingBlocks: number;
  pickId: number | null;
  power: number;
  feedCost: number;
};

export type PickView = { id: number; grade: Grade; durability: number; minerId: number | null; repairCost: number };

export type MineView = {
  height: number;
  aura: number;
  slots: number;
  used: number;
  pools: PoolView[];
  miners: MinerView[];
  picks: PickView[];
  rushWins: { height: number; pool: PoolId; amount: number }[];
};

// Admin dashboard (read-only). Values come back as JSON: big integers as strings, timestamps as ISO strings.

export type AdminColumn = { name: string; type: string; nullable: boolean; default: string | null };
export type AdminTable = { name: string; rows: number; columns: AdminColumn[]; indexes: string[] };
export type AdminOverview = {
  network: string;
  tables: AdminTable[];
  /** $aura across every balance. */
  auraSupply: number;
  /** $aura per ledger kind: minted (positive kinds) and burned (negative). */
  ledgerByKind: { kind: string; total: number; entries: number }[];
  settledHeight: number | null;
};
export type AdminRows = { table: string; columns: string[]; rows: Record<string, unknown>[]; total: number; limit: number; offset: number };
export type AdminQueryResult = { columns: string[]; rows: Record<string, unknown>[]; rowCount: number; truncated: boolean; ms: number };

// Exchange rewards: a fixed $aura pool per UTC day, shared by builder fees paid that day.

export type ExchangeDayView = {
  day: string;
  emission: number;
  totalFees: number;
  players: number;
  /** Where the day's fees came from: Hyperliquid's builder file (mainnet) or fills seen (testnet). */
  source: 'file' | 'fills';
  yourFees: number;
  yourAura: number;
};
export type ExchangeView = {
  /** Today, as YYYYMMDD (UTC). */
  day: string;
  /** When today's pool closes (ms). */
  endsAt: number;
  /** $aura shared out per day. */
  emission: number;
  source: 'file' | 'fills';
  /** Builder fees seen so far today (USD), across players who synced. The final total can be higher. */
  totalFees: number;
  yourFees: number;
  /** Your share of today's pool if the day ended now. */
  yourEstimate: number;
  /** $aura not settled yet: today's estimate plus finished days still waiting to settle. */
  pendingAura: number;
  history: ExchangeDayView[];
};
