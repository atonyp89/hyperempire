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
// Each building has its own Mastery, levelled only by that building's actions. The Townhall caps every Mastery
// at its own level and adds Mastery XP everywhere. Mastery itself isn't built yet: every building reports
// level 0 until it is.

export type MasteryId = 'exchange' | 'tavern' | 'workshop' | 'garden' | 'mine';

export type Mastery = {
  id: MasteryId;
  name: string;
  /** What earns this building's Mastery XP. */
  xpFrom: string;
  /** First draft of its perk tree (see the game design). */
  perks: string[];
  sprite: string;
  /** Townhall level the building opens at (placeholders), if it's gated. */
  opensAt?: number;
};

export const MASTERIES: Mastery[] = [
  { id: 'exchange', name: 'EXCHANGE', xpFrom: 'Builder fees you pay', perks: ['Lower fees', 'Streak', 'Market maker', 'Patron', "Whale's ear"], sprite: '/empire/exchange.png' },
  { id: 'mine', name: 'MINE', xpFrom: 'Blocks your Miners mine', perks: ['Foreman: +1 Miner slot', 'Less energy drain', 'Shorter walks'], sprite: '/empire/mine.png' },
  { id: 'tavern', name: 'TAVERN', xpFrom: 'Recruits and merges, failed ones too', perks: ['Barracks: +1 hero slot', 'Drill', 'Scout', 'Swift march', 'Warlord'], sprite: '/empire/tavern.png', opensAt: 20 },
  { id: 'workshop', name: 'WORKSHOP', xpFrom: 'Crafts, repairs and merges', perks: ['Steady hands', 'Bulk forge', 'Salvager', 'Master artisan'], sprite: '/empire/workshop.png' },
  { id: 'garden', name: 'GARDEN', xpFrom: 'Harvests', perks: ['Green thumb', 'More plots', 'Rare seeds', 'Decorations'], sprite: '/empire/garden.png', opensAt: 30 },
];

/** No building's Mastery can be higher than the Townhall level. */
export const masteryCap = (townhallLevel: number) => townhallLevel;

/** Extra Mastery XP in every building per Townhall level (+1%). */
export const MASTERY_XP_BONUS_PER_LEVEL = 0.01;
export const masteryXpBonus = (townhallLevel: number) => townhallLevel * MASTERY_XP_BONUS_PER_LEVEL;
