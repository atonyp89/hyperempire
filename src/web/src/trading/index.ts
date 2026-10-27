// Public API of the trading part. Code outside src/trading imports from here only, never from its
// internals, so trading can change inside without breaking the game (src/architecture.test.ts checks this).

export { TradingTerminal } from './TradingTerminal';
export { captureReferral } from './lib/referral';
export { AURA_PER_USD_FEE, BUILDER_FEE_RATE } from './config';
