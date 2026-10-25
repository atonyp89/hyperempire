// $aura rewards: every $1 of HyperEmpire builder fee paid earns AURA_PER_USD_FEE $aura.

import { AURA_PER_USD_FEE, BUILDER_FEE_RATE } from '../config';

/** $aura earned for a builder fee paid in USD. */
export const auraForFee = (feeUsd: number) => Math.max(0, feeUsd) * AURA_PER_USD_FEE;

/** $aura a fill of this notional would earn at the current builder fee. */
export const auraForNotional = (notionalUsd: number) => auraForFee(notionalUsd * BUILDER_FEE_RATE);
