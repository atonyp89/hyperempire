// Garden rules: a 4x4 field of plots, and the crops that grow in them. Seeds are inventory items bought with
// $gold; a planted seed grows through its stages on the clock (no upkeep yet) and can be harvested once ripe,
// giving crops into the player's inventory.
// Design: docs/economy/game-design.md ("Garden").

export const GARDEN_COLS = 4;
export const GARDEN_ROWS = 4;
export const GARDEN_PLOTS = GARDEN_COLS * GARDEN_ROWS;

export type CropId = 'wheat';

export type Crop = {
  id: CropId;
  name: string;
  /** $gold a seed costs at the Garden. */
  seedGold: number;
  /** Time from planting to ripe, in ms. */
  growMs: number;
  /** Growth stages, sprout first and ripe last; the sprite sheet has one frame per stage. */
  stages: number;
  /** Crops one ripe plant gives. */
  yield: number;
  /** Sprite sheet: one frame per stage, left to right. */
  sprite: string;
  /** Inventory icons: the harvested crop, and its seed. */
  icon: string;
  seedIcon: string;
};

/** Test values: wheat ripens in 3 minutes so the whole cycle can be tried quickly. */
export const CROPS: Record<CropId, Crop> = {
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    seedGold: 10,
    growMs: 3 * 60_000,
    stages: 3,
    yield: 3,
    sprite: '/empire/crops/wheat.png',
    icon: '/empire/items/wheat.png',
    seedIcon: '/empire/items/wheat-seed.png',
  },
};

export const isCropId = (v: unknown): v is CropId => typeof v === 'string' && Object.hasOwn(CROPS, v);

/** Most seeds one purchase can buy. */
export const MAX_SEED_BUY = 99;

/** A crop's seed, as an inventory item id ("wheat-seed"). The crop itself is the item id "wheat". */
export const seedItem = (crop: CropId) => `${crop}-seed`;

/** The crop a seed item grows, or null if the id isn't a seed. */
export function cropOfSeed(item: string): CropId | null {
  const id = item.endsWith('-seed') ? item.slice(0, -'-seed'.length) : null;
  return isCropId(id) ? id : null;
}

/** Time a crop takes to ripen: its growing time, divided by the game speed (1, or more on the dev server). */
export const growTime = (crop: Crop, speed = 1) => crop.growMs / speed;

/** Growth stage at `now`: 0 (just planted) up to stages − 1 (ripe), evenly spaced; ripe from `readyAt` on. */
export function cropStage(crop: Crop, plantedAt: number, readyAt: number, now: number): number {
  const t = (now - plantedAt) / (readyAt - plantedAt);
  if (t >= 1) return crop.stages - 1;
  return Math.max(0, Math.floor(t * (crop.stages - 1)));
}
