// Townhall rules: level costs, risky upgrades, perk tree, respec. Numbers follow docs/economy/game-design.md. The server
// enforces them; the web app imports the same catalog (through contract.ts) to draw the Townhall screen.

export type BranchId = 'trader' | 'fighter' | 'crafter';

export type Perk = {
  id: string;
  branch: BranchId;
  /** 1 = open, 2 = needs TIER_POINTS[2] points in the branch, 3 = needs TIER_POINTS[3]. */
  tier: 1 | 2 | 3;
  name: string;
  /** What one rank does, shown under the name. */
  effect: string;
  maxRank: number;
  icon: string;
};

export type Branch = { id: BranchId; name: string; who: string; icon: string; live: boolean; phase: string };

const ICON = (name: string) => `/empire/icons/${name}.png`;

export const BRANCHES: Branch[] = [
  { id: 'trader', name: 'TRADER', who: 'Lower costs, more $aura from trading', icon: ICON('branch-trader'), live: true, phase: 'LIVE' },
  { id: 'fighter', name: 'FIGHTER', who: 'Stronger heroes and adventures', icon: ICON('branch-fighter'), live: false, phase: 'PHASE 2' },
  { id: 'crafter', name: 'CRAFTER', who: 'Better gardens, salvage and crafts', icon: ICON('branch-crafter'), live: false, phase: 'PHASE 3' },
];

export const PERKS: Perk[] = [
  { id: 'lower-fees', branch: 'trader', tier: 1, name: 'Lower fees', effect: '−1% builder fee per rank', maxRank: 5, icon: ICON('perk-lower-fees') },
  { id: 'streak', branch: 'trader', tier: 1, name: 'Streak', effect: '+1% $aura per rank for each day of your trading streak (7 days max)', maxRank: 3, icon: ICON('perk-streak') },
  { id: 'market-maker', branch: 'trader', tier: 2, name: 'Market maker', effect: '+5% $aura on maker fills per rank', maxRank: 3, icon: ICON('perk-market-maker') },
  { id: 'patron', branch: 'trader', tier: 2, name: 'Patron', effect: '+5% referral share per rank', maxRank: 3, icon: ICON('perk-patron') },
  { id: 'whales-ear', branch: 'trader', tier: 3, name: "Whale's ear", effect: 'Once a day, 10% of one trade’s builder fee back as $aura', maxRank: 1, icon: ICON('perk-whales-ear') },

  { id: 'drill', branch: 'fighter', tier: 1, name: 'Drill', effect: '+1 ATK and DEF for all heroes per rank', maxRank: 5, icon: ICON('branch-fighter') },
  { id: 'barracks', branch: 'fighter', tier: 1, name: 'Barracks', effect: '+1 hero slot in the Tavern per rank', maxRank: 3, icon: ICON('branch-fighter') },
  { id: 'scout', branch: 'fighter', tier: 2, name: 'Scout', effect: '+3% adventure success odds per rank', maxRank: 5, icon: ICON('branch-fighter') },
  { id: 'swift-march', branch: 'fighter', tier: 2, name: 'Swift march', effect: '−5% adventure lock time per rank', maxRank: 3, icon: ICON('branch-fighter') },
  { id: 'warlord', branch: 'fighter', tier: 3, name: 'Warlord', effect: 'Heroes start every adventure with a free buff', maxRank: 1, icon: ICON('branch-fighter') },

  { id: 'foreman', branch: 'crafter', tier: 1, name: 'Foreman', effect: '+1 Miner slot in the Mine per rank', maxRank: 5, icon: ICON('branch-crafter') },
  { id: 'green-thumb', branch: 'crafter', tier: 1, name: 'Green thumb', effect: '−5% garden growth time per rank', maxRank: 5, icon: ICON('branch-crafter') },
  { id: 'salvager', branch: 'crafter', tier: 1, name: 'Salvager', effect: '+5% materials from salvage per rank', maxRank: 5, icon: ICON('branch-crafter') },
  { id: 'steady-hands', branch: 'crafter', tier: 2, name: 'Steady hands', effect: '+3% craft quality odds per rank', maxRank: 5, icon: ICON('branch-crafter') },
  { id: 'bulk-forge', branch: 'crafter', tier: 2, name: 'Bulk forge', effect: '−5% $aura cost to craft per rank', maxRank: 3, icon: ICON('branch-crafter') },
  { id: 'master-artisan', branch: 'crafter', tier: 3, name: 'Master artisan', effect: 'Crafts can roll one extra affix', maxRank: 1, icon: ICON('branch-crafter') },
];

/** Points spent in a branch needed to open each tier. */
export const TIER_POINTS = { 1: 0, 2: 5, 3: 15 } as const;

/** Starter $aura that comes with the empire mint. */
export const STARTER_AURA = 5_000;

/** Cumulative fee-discount cap across the Exchange building and Trader perks. */
export const FEE_DISCOUNT_CAP = 0.4;

/** $aura to go from `level` to `level + 1`: 1,000 × (level + 1)^1.6. */
export const levelCost = (level: number) => Math.round(1000 * Math.pow(level + 1, 1.6));

/** Respec cost rises with each respec and with Townhall level, like rerolls. */
export const respecCost = (level: number, respecs: number) => Math.round(5000 * Math.pow(1.5, respecs) * (1 + level / 20));

/** One perk point per Townhall level. */
export const perkPoints = (level: number) => level;

export const branchSpent = (ranks: Record<string, number>, branch: BranchId) =>
  PERKS.filter((p) => p.branch === branch).reduce((s, p) => s + (ranks[p.id] ?? 0), 0);

export const totalSpent = (ranks: Record<string, number>) => Object.values(ranks).reduce((s, r) => s + r, 0);

/** Buildings whose level the Townhall caps, and when locked ones open. */
export const BUILDING_CAPS = [
  { name: 'EXCHANGE', unlockAt: 1, current: 1 },
  { name: 'TAVERN', unlockAt: 20, current: 0 },
  { name: 'GARDEN', unlockAt: 30, current: 0 },
];
