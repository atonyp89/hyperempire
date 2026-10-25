// Public API of the trading part. Code outside src/trading imports from here only, never from its
// internals, so trading can change inside without breaking the game (src/architecture.test.ts checks this).

import { useMemo } from 'react';
import { useFills } from './hooks/useTraderData';

export { TradingTerminal } from './TradingTerminal';
export { captureReferral } from './lib/referral';
export { AURA_PER_USD_FEE, BUILDER_FEE_RATE } from './config';

/** $aura earned so far from the builder fees on this wallet's fills (0 without a wallet). */
export function useAuraEarned(user: `0x${string}` | undefined): number {
  const fills = useFills(user);
  return useMemo(() => (fills.data ?? []).reduce((sum, f) => sum + f.aura, 0), [fills.data]);
}
