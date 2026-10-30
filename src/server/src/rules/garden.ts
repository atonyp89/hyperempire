// Garden rules: a 4x4 field of plots, and the crops that grow in them. Seeds come in packs bought with $gold; a
// pack opens into 10 seeds of random grades (the Miners' grades and odds), and a better seed yields more. A planted
// seed grows through its stages on the clock (no upkeep yet) and can be harvested once ripe, giving crops into the
// player's inventory.
// Design: docs/economy/game-design.md ("Garden").

import { GRADE, GRADES, type Grade } from './mining';

export const GARDEN_COLS = 4;
export const GARDEN_ROWS = 4;
export const GARDEN_PLOTS = GARDEN_COLS * GARDEN_ROWS;

export type CropId = 'wheat' | 'grapes';

export type Crop = {
  id: CropId;
  name: string;
  /** What one seed is called ("Grape seed"); a graded one adds its grade ("Rare grape seed"). */
  seedName: string;
  /** What a pack of its seeds is called ("Grape seed pack"). */
  packName: string;
  /** $gold per seed; a pack costs PACK_SEEDS of them. */
  seedGold: number;
  /** Time from planting to ripe, in ms. */
  growMs: number;
  /** Growth stages, sprout first and ripe last; the sprite sheet has one frame per stage. */
  stages: number;
  /** Crops one ripe plant of a common seed gives; better grades multiply it (SEED_YIELD). */
  yield: number;
  /** Sprite sheet: one frame per stage, left to right. */
  sprite: string;
  /** Inventory icons: the harvested crop, its seed, and a pack of its seeds. */
  icon: string;
  seedIcon: string;
  packIcon: string;
};

/** Test values: wheat ripens in 3 minutes and grapes in 6, so the whole cycle can be tried quickly. */
export const CROPS: Record<CropId, Crop> = {
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    seedName: 'Wheat seed',
    packName: 'Wheat seed pack',
    seedGold: 10,
    growMs: 3 * 60_000,
    stages: 3,
    yield: 30,
    sprite: '/empire/crops/wheat.png',
    icon: '/empire/items/wheat.png',
    seedIcon: '/empire/items/wheat-seed.png',
    packIcon: '/empire/items/wheat-pack.png',
  },
  grapes: {
    id: 'grapes',
    name: 'Grapes',
    seedName: 'Grape seed',
    packName: 'Grape seed pack',
    seedGold: 25,
    growMs: 6 * 60_000,
    stages: 3,
    yield: 40,
    sprite: '/empire/crops/grapes.png',
    icon: '/empire/items/grapes.png',
    seedIcon: '/empire/items/grapes-seed.png',
    packIcon: '/empire/items/grapes-pack.png',
  },
};

export const isCropId = (v: unknown): v is CropId => typeof v === 'string' && Object.hasOwn(CROPS, v);

/** Seeds in one pack. */
export const PACK_SEEDS = 10;
/** Most packs one purchase can buy, or one call can open. */
export const MAX_PACKS = 10;
export const packGold = (crop: Crop) => crop.seedGold * PACK_SEEDS;

/** Yield multiplier by seed grade; grades are rolled with the Miners' odds (70 / 22 / 6.5 / 1.4 / 0.1%). */
export const SEED_YIELD: Record<Grade, number> = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 };

/**
 * Crops one ripe plant gives: wheat 30 / 45 / 60 / 90 / 150 and grapes 40 / 60 / 80 / 120 / 200 from common to
 * legendary. Yields are in tens so a small bonus (a +10% Farmer) still shows after rounding.
 */
export const yieldOf = (crop: Crop, grade: Grade) => Math.round(crop.yield * SEED_YIELD[grade]);

// Inventory item ids: the crop itself is "wheat"; a pack is "wheat-pack"; a seed is "wheat-seed:rare".

export const packItem = (crop: CropId) => `${crop}-pack`;
export const seedItem = (crop: CropId, grade: Grade) => `${crop}-seed:${grade}`;

/** The crop a pack item holds seeds of, or null if the id isn't a pack. */
export function cropOfPack(item: string): CropId | null {
  const id = item.endsWith('-pack') ? item.slice(0, -'-pack'.length) : null;
  return isCropId(id) ? id : null;
}

/** The crop and grade of a seed item, or null if the id isn't a seed. */
export function parseSeed(item: string): { crop: CropId; grade: Grade } | null {
  const m = /^(.+)-seed:(.+)$/.exec(item);
  if (!m || !isCropId(m[1]) || !(GRADES as readonly string[]).includes(m[2])) return null;
  return { crop: m[1], grade: m[2] as Grade };
}

/** Time a crop takes to ripen: its growing time, divided by the game speed (1, or more on the dev server). */
export const growTime = (crop: Crop, speed = 1) => crop.growMs / speed;

/** Growth stage at `now`: 0 (just planted) up to stages − 1 (ripe), evenly spaced; ripe from `readyAt` on. */
export function cropStage(crop: Crop, plantedAt: number, readyAt: number, now: number): number {
  const t = (now - plantedAt) / (readyAt - plantedAt);
  if (t >= 1) return crop.stages - 1;
  return Math.max(0, Math.floor(t * (crop.stages - 1)));
}

// ---------------------------------------------------------------- Selling crops to the NPC

/**
 * What a pack is worth back, on average, when its crops are sold to the NPC: 1.1x its price. Grade luck makes the
 * average seed yield more than a common one, and the price is set so that luck pays exactly this much across all
 * players; Farmers' yield bonuses come on top. The price per crop always stays below the pack's cost per crop
 * from common seeds, so selling to the NPC can't mint $gold faster than seeds cost.
 */
export const SELL_ROI = 1.1;

/** Crops one seed of a crop yields on average, over the grade odds (wheat 36.2, grapes 48.3). */
export const expectedYield = (crop: Crop) => GRADES.reduce((sum, g) => sum + GRADE[g].odds * yieldOf(crop, g), 0);

/** $gold the NPC pays per crop, unrounded: wheat ~0.304, grapes ~0.570. */
export const cropPrice = (crop: Crop) => (SELL_ROI * packGold(crop)) / (PACK_SEEDS * expectedYield(crop));

/** $gold for selling `qty` of a crop: whole $gold, rounded down. */
export const sellGold = (crop: Crop, qty: number) => Math.floor(qty * cropPrice(crop));
