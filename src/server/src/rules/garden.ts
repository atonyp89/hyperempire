// Garden rules: a 4x4 field of plots, and the crops that grow in them. A planted seed grows through its stages
// on the clock (no upkeep yet) and can be harvested once ripe, giving crops into the player's inventory.
// Design: docs/economy/game-design.md ("Garden").

export const GARDEN_COLS = 4;
export const GARDEN_ROWS = 4;
export const GARDEN_PLOTS = GARDEN_COLS * GARDEN_ROWS;

export type CropId = 'wheat';

export type Crop = {
  id: CropId;
  name: string;
  /** $gold a seed costs, paid when planting. */
  seedGold: number;
  /** Time from planting to ripe, in ms. */
  growMs: number;
  /** Growth stages, seed first and ripe last; the sprite sheet has one frame per stage. */
  stages: number;
  /** Crops one ripe plant gives. */
  yield: number;
  /** Sprite sheet: one frame per stage, left to right. */
  sprite: string;
};

/** Test values: wheat ripens in 3 minutes so the whole cycle can be tried quickly. */
export const CROPS: Record<CropId, Crop> = {
  wheat: { id: 'wheat', name: 'Wheat', seedGold: 10, growMs: 3 * 60_000, stages: 4, yield: 3, sprite: '/empire/crops/wheat.png' },
};

export const isCropId = (v: unknown): v is CropId => typeof v === 'string' && Object.hasOwn(CROPS, v);

/** Growth stage at `now`: 0 (seed) up to stages − 1 (ripe), evenly spaced; ripe once the full time has passed. */
export function cropStage(crop: Crop, plantedAt: number, now: number): number {
  const t = (now - plantedAt) / crop.growMs;
  if (t >= 1) return crop.stages - 1;
  return Math.max(0, Math.floor(t * (crop.stages - 1)));
}
