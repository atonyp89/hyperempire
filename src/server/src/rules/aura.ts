// $aura amounts. Balances are stored in milli-$aura (1 $aura = 1,000 units) so block shares split exactly.

export const UNITS = 1_000;
export const toUnits = (aura: number) => Math.round(aura * UNITS);
export const fromUnits = (units: number) => units / UNITS;

/** Starter $aura that comes with every new empire. */
export { STARTER_AURA } from './empire';

/** $aura per $1 of builder fee paid (k = 0.5 notional, ×1,000 multiplier). */
export const AURA_PER_USD_FEE = 500;
