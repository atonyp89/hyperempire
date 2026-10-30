// Food rules: villagers get hungry while they work and die when hunger reaches 0; $aura brings them back. They eat
// bread, made from the Garden's wheat in two steps (wheat → flour → bread), each of which can fail and lose its
// input. Only Farmers eat so far; Miners will eat the same bread when the Mine ships.
// Design: docs/economy/game-design.md ("Food and hunger").

import type { Grade } from './mining';

/** Hunger runs from HUNGER_FULL (just fed) down to 0 (dead). */
export const HUNGER_FULL = 100;
/** How long a full villager lasts while working: 3 days, so a missed day or a weekend away isn't fatal. */
export const MEAL_MS = 3 * 24 * 60 * 60_000;
/** Hunger one bread restores: a day's worth, so a working villager eats 1 bread a day. */
export const BREAD_HUNGER = HUNGER_FULL / 3;
/** Hunger a revived villager comes back with: a day's worth, so it still needs bread soon. */
export const REVIVE_HUNGER = BREAD_HUNGER;

/** $aura to bring a dead villager back (burned): far below what recruiting another of its grade takes on average. */
export const REVIVE_AURA: Record<Grade, number> = { common: 250, uncommon: 500, rare: 1_000, epic: 2_500, legendary: 10_000 };

/**
 * Hunger at `now`: the stored value, minus what has drained since `since` (null while resting: it doesn't drain).
 * `speed` is the game speed (1, or more on the dev server).
 */
export function hungerAt(stored: number, since: number | null, now: number, speed = 1): number {
  if (since == null) return stored;
  return Math.max(0, stored - ((now - since) * speed * HUNGER_FULL) / MEAL_MS);
}

/** When a working villager reaches 0, or null while resting. */
export function diesAt(stored: number, since: number | null, speed = 1): number | null {
  return since == null ? null : since + (stored / HUNGER_FULL) * (MEAL_MS / speed);
}

// ---------------------------------------------------------------- Kitchen: wheat → flour → bread

export type RecipeId = 'flour' | 'bread';

export type Recipe = {
  /** The item it makes, one per success. */
  id: RecipeId;
  name: string;
  /** What the step is called on its button ("Mill"). */
  verb: string;
  /** The item each try takes, and how many. */
  input: string;
  inputQty: number;
  /** Chance a try succeeds; a failed try loses its input. */
  chance: number;
  icon: string;
};

/**
 * Test values, tuned so food stays a small cost (docs/economy/game-design.md, "Food and hunger"): on average a
 * bread takes 5 / 0.8 × 2 / 0.8 = 15.6 wheat, about 4.7 $gold at the NPC's price.
 */
export const RECIPES: Record<RecipeId, Recipe> = {
  flour: { id: 'flour', name: 'Flour', verb: 'Mill', input: 'wheat', inputQty: 5, chance: 0.8, icon: '/empire/items/flour.png' },
  bread: { id: 'bread', name: 'Bread', verb: 'Bake', input: 'flour', inputQty: 2, chance: 0.8, icon: '/empire/items/bread.png' },
};

export const isRecipeId = (v: unknown): v is RecipeId => typeof v === 'string' && Object.hasOwn(RECIPES, v);

/** Most tries one call can make. */
export const MAX_CRAFTS = 100;

/** Wheat one bread takes on average, failures included. */
export const wheatPerBread = () => (RECIPES.flour.inputQty / RECIPES.flour.chance) * (RECIPES.bread.inputQty / RECIPES.bread.chance);
