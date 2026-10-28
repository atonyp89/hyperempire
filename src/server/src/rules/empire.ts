// Townhall rules: level costs and risky upgrades, and what the Townhall level gives every building's Mastery.
// Numbers follow docs/economy/game-design.md. The server enforces them; the web app imports the same catalog
// (through contract.ts) to draw the Townhall screen.

/** Starter $aura that comes with the empire mint. */
export const STARTER_AURA = 5_000;

/** $aura to go from `level` to `level + 1`: 1,000 × (level + 1)^1.6. */
export const levelCost = (level: number) => Math.round(1000 * Math.pow(level + 1, 1.6));

/** Cumulative fee-discount cap from Exchange Mastery perks. */
export const FEE_DISCOUNT_CAP = 0.4;

// ---------------------------------------------------------------- Mastery
// Each building has its own Mastery, levelled only by that building's actions and shown in that building. The
// Townhall caps every Mastery at its own level and adds Mastery XP everywhere. Rules in rules/mastery.ts.

export type MasteryId = 'exchange' | 'tavern' | 'workshop' | 'garden' | 'mine';

/** No building's Mastery can be higher than the Townhall level. */
export const masteryCap = (townhallLevel: number) => townhallLevel;

/** Extra Mastery XP in every building per Townhall level (+1%). */
export const MASTERY_XP_BONUS_PER_LEVEL = 0.01;
export const masteryXpBonus = (townhallLevel: number) => townhallLevel * MASTERY_XP_BONUS_PER_LEVEL;
