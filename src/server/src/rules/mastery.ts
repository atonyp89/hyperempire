// Mastery rules: XP and levels (the same curve for every building), and Exchange Mastery's perks. A building's
// Mastery can't be higher than the Townhall level; XP past the cap is kept and counts once the Townhall rises.
// Design: docs/economy/game-design.md ("Mastery").

import type { MasteryId } from './empire';

/** Exchange Mastery XP per $1 of builder fee, counted at the list rate (a discount never slows Mastery). */
export const XP_PER_USD_FEE = 100;

/** XP to go from level n to n + 1: 100 × n². Exchange Mastery 25 ≈ $4.9k of fees ≈ $10M volume at 0.05%. */
export const xpToNext = (level: number) => 100 * level * level;

/** Total XP to reach `level` from level 1: 100 × (1² + … + (level − 1)²). */
export const xpForLevel = (level: number) => (100 * (level - 1) * level * (2 * level - 1)) / 6;

export type MasteryLevel = {
  /** The level that counts: capped by the Townhall. */
  level: number;
  /** The level the XP alone would give. */
  uncapped: number;
  /** XP into the current uncapped level, and XP that level needs. */
  xpIntoLevel: number;
  xpForNext: number;
};

/** Level from total XP, capped at `cap` (the Townhall level). Everyone starts at level 1. */
export function masteryLevel(xp: number, cap: number): MasteryLevel {
  let uncapped = 1;
  while (xpForLevel(uncapped + 1) <= xp) uncapped++;
  return { level: Math.max(1, Math.min(uncapped, cap)), uncapped, xpIntoLevel: xp - xpForLevel(uncapped), xpForNext: xpToNext(uncapped) };
}

/** One point per Mastery level, spent in that building's tree. */
export const masteryPoints = (level: number) => level;

/** Respec of one building's tree: rises with each respec and with the Mastery level. */
export const masteryRespecCost = (level: number, respecs: number) => Math.round(5000 * Math.pow(1.5, respecs) * (1 + level / 20));

export type MasteryPerk = { id: string; name: string; effect: string; maxRank: number; icon: string };

// ---------------------------------------------------------------- Exchange Mastery

export type ExchangePerkId = 'lower-fees' | 'market-maker' | 'taker' | 'whale';

/** Builder fee cut per rank of Lower fees. */
export const LOWER_FEES_PER_RANK = 0.02;
/** Pool weight per rank of Market maker, Taker and Whale. */
export const WEIGHT_PER_RANK = 0.03;
/** Whale's bonus applies on UTC days with at least this much volume (USD). */
export const WHALE_DAILY_VOLUME = 100_000;

const ICON = (name: string) => `/empire/icons/${name}.png`;

export const EXCHANGE_PERKS: (MasteryPerk & { id: ExchangePerkId })[] = [
  { id: 'lower-fees', name: 'Lower fees', effect: '−2% builder fee per rank', maxRank: 10, icon: ICON('perk-lower-fees') },
  { id: 'market-maker', name: 'Market maker', effect: '+3% pool weight on your maker fills per rank', maxRank: 5, icon: ICON('perk-market-maker') },
  { id: 'taker', name: 'Taker', effect: '+3% pool weight on your taker fills per rank', maxRank: 5, icon: ICON('perk-streak') },
  { id: 'whale', name: 'Whale', effect: '+3% pool weight on all your fees per rank, on days you trade $100k or more', maxRank: 5, icon: ICON('perk-whales-ear') },
];

export const MASTERY_PERKS: Partial<Record<MasteryId, MasteryPerk[]>> = { exchange: EXCHANGE_PERKS };

export type Ranks = Record<string, number>;
const rank = (ranks: Ranks, id: ExchangePerkId) => ranks[id] ?? 0;

/** The builder-fee discount earned (0.2 = −20%). */
export const feeDiscount = (ranks: Ranks) => rank(ranks, 'lower-fees') * LOWER_FEES_PER_RANK;

/** The builder fee to charge, in tenths of a basis point (Hyperliquid's unit), after the discount. */
export const discountedFeeTenths = (listTenths: number, ranks: Ranks) => Math.round(listTenths * (1 - feeDiscount(ranks)));

/**
 * The fee a fill counts for: what was paid, scaled back up by the discount the player earned, but never more than
 * the fee at the list rate. A discount keeps full weight; paying less than you're entitled to (a modified client)
 * only lowers your count. Old rows without the trade's size count as paid.
 */
export function countedFee(feeMicro: number, notionalMicro: number | null, listRate: number, ranks: Ranks): number {
  const scaled = feeMicro / (1 - feeDiscount(ranks));
  return notionalMicro == null ? feeMicro : Math.min(scaled, notionalMicro * listRate);
}

/** A fill's weight in the daily pool: its counted fee plus the style perks that apply to it. */
export function fillWeight(counted: number, crossed: boolean | null, ranks: Ranks, whaleDay: boolean): number {
  const style = crossed == null ? 0 : rank(ranks, crossed ? 'taker' : 'market-maker') * WEIGHT_PER_RANK;
  const whale = whaleDay ? rank(ranks, 'whale') * WEIGHT_PER_RANK : 0;
  return counted * (1 + style + whale);
}
