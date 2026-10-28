// Mining rules: Miner and Pick grades, recruit and craft odds, merges, upkeep, pools and block rewards.
// Numbers are the starting points in docs/economy/game-design.md ("Mining (Phase 2)"); tune them here.

export const GRADES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Grade = (typeof GRADES)[number];

type GradeRow = {
  /** Chance to roll this grade when recruiting a Miner or crafting a Pick. */
  odds: number;
  /** Chance that merging two of this grade makes one of the next (Legendary can't merge). */
  merge: number;
  minerPower: number;
  pickMultiplier: number;
  /** $aura to refill a Miner of this grade from 0 to 100 energy (about a day of mining). */
  food: number;
  /** Blocks a Pick of this grade lasts from full durability (1,440 blocks = 1 day). */
  pickLife: number;
  /** $aura to repair a Pick of this grade from 0 to full. */
  repair: number;
};

export const GRADE: Record<Grade, GradeRow> = {
  common: { odds: 0.7, merge: 0.5, minerPower: 10, pickMultiplier: 1.1, food: 20, pickLife: 1_440, repair: 50 },
  uncommon: { odds: 0.22, merge: 0.4, minerPower: 35, pickMultiplier: 1.25, food: 60, pickLife: 2_880, repair: 150 },
  rare: { odds: 0.065, merge: 0.3, minerPower: 150, pickMultiplier: 1.5, food: 220, pickLife: 4_320, repair: 500 },
  epic: { odds: 0.014, merge: 0.15, minerPower: 800, pickMultiplier: 2, food: 1_000, pickLife: 7_200, repair: 2_000 },
  legendary: { odds: 0.001, merge: 0, minerPower: 6_000, pickMultiplier: 3, food: 6_000, pickLife: 10_080, repair: 10_000 },
};

export const RECRUIT_COST = 1_000;
export const CRAFT_COST = 600;

/** Miner slots everyone starts with. The Foreman perk (Mine Mastery, not built yet) will add more. */
export const BASE_SLOTS = 3;

/** A Miner's energy drains from 100 to 0 over this many blocks of mining. */
export const ENERGY_BLOCKS = 1_440;
/** Blocks a Miner spends walking to a new pool before it mines there. */
export const WALK_BLOCKS = 3;

/** One block every 60 s, counted from GENESIS. */
export const BLOCK_MS = 60_000;
export const GENESIS = Date.UTC(2026, 9, 1);
/** The most blocks settled in one catch-up (7 days), so a long gap can't stall a request. */
export const MAX_CATCH_UP = 10_080;

export type PoolKind = 'shared' | 'rush';
export type RewardId = 'aura';

/** Per-reward block config, set by the team each week or season. */
export type RewardConfig = {
  id: RewardId;
  name: string;
  /** Reward per block, split between the pools. */
  perBlock: number;
  split: Record<PoolKind, number>;
  rushEnabled: boolean;
};

export const REWARDS: RewardConfig[] = [
  { id: 'aura', name: '$aura', perBlock: 100, split: { shared: 0.5, rush: 0.5 }, rushEnabled: true },
];

/** Pool ids as stored on a deployed Miner, e.g. "aura:shared". */
export type PoolId = `${RewardId}:${PoolKind}`;
export const POOL_IDS: PoolId[] = REWARDS.flatMap((r) => (['shared', 'rush'] as const).filter((k) => k === 'shared' || r.rushEnabled).map((k) => `${r.id}:${k}` as PoolId));
export const isPoolId = (v: unknown): v is PoolId => typeof v === 'string' && (POOL_IDS as string[]).includes(v);

/** Roll a grade from the recruit / craft odds with a uniform random number in [0, 1). */
export function rollGrade(r: number): Grade {
  let acc = 0;
  for (const g of GRADES) {
    acc += GRADE[g].odds;
    if (r < acc) return g;
  }
  return 'common';
}

export const nextGrade = (g: Grade): Grade | null => GRADES[GRADES.indexOf(g) + 1] ?? null;

/** Mining power of a Miner, with its Pick's multiplier while the Pick has durability left. */
export const minerPower = (grade: Grade, pick?: { grade: Grade; durability: number } | null) =>
  GRADE[grade].minerPower * (pick && pick.durability > 0 ? GRADE[pick.grade].pickMultiplier : 1);

export const blockHeight = (nowMs: number) => Math.floor((nowMs - GENESIS) / BLOCK_MS);
