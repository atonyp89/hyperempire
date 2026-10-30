// Farmer rules: Farmers are recruited at the Tavern for $aura with a random grade (the Miners' grades and odds),
// and each rolls two perks within its grade's range: more yield and shorter growing time. Up to FARMER_SLOTS
// Farmers work the Garden at once; their perks add up.
// Design: docs/economy/game-design.md ("Farmers").

import { rollGrade, type Grade } from './mining';

/** $aura a Farmer recruit costs (burned), like a Miner's. */
export const FARMER_RECRUIT_AURA = 1_000;
/** Farmers that can work the Garden at once. */
export const FARMER_SLOTS = 3;
/** The most the Garden's growing time can be cut, whatever the Farmers roll. */
export const MAX_GROWTH_CUT = 60;

/** Each perk's roll range by grade, in whole percent [min, max]: the grade caps how good a Farmer can be. */
export const FARMER_PERKS: Record<Grade, { yield: [number, number]; growth: [number, number] }> = {
  common: { yield: [1, 5], growth: [1, 4] },
  uncommon: { yield: [4, 10], growth: [3, 8] },
  rare: { yield: [8, 18], growth: [6, 12] },
  epic: { yield: [15, 30], growth: [10, 18] },
  legendary: { yield: [25, 50], growth: [15, 25] },
};

const between = ([lo, hi]: [number, number], r: number) => lo + Math.floor(r * (hi - lo + 1));

/** A new Farmer from three uniform random numbers: its grade, then its two perks within that grade's ranges. */
export function rollFarmer(r1: number, r2: number, r3: number): { grade: Grade; yieldPct: number; growthPct: number } {
  const grade = rollGrade(r1);
  const p = FARMER_PERKS[grade];
  return { grade, yieldPct: between(p.yield, r2), growthPct: between(p.growth, r3) };
}

/**
 * What the Garden's working Farmers add up to: +yield and −growing time, in percent (growth capped). Each Farmer's
 * perks count by its `scale` (its mood: 1 happy, 0.5 unhappy, 0 miserable; 1 when left out).
 */
export function farmerBonus(farmers: { yieldPct: number; growthPct: number; scale?: number }[]) {
  return {
    yieldPct: farmers.reduce((s, f) => s + f.yieldPct * (f.scale ?? 1), 0),
    growthPct: Math.min(MAX_GROWTH_CUT, farmers.reduce((s, f) => s + f.growthPct * (f.scale ?? 1), 0)),
  };
}
