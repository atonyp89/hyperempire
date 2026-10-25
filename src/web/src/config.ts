// App configuration from Vite env vars (see .env.example).

const env = import.meta.env;

export type Network = 'mainnet' | 'testnet';

export const NETWORK: Network = env.VITE_HL_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
export const IS_TESTNET = NETWORK === 'testnet';

const builder = (env.VITE_BUILDER_ADDRESS ?? '').trim();
export const BUILDER_ADDRESS: `0x${string}` | null = /^0x[0-9a-fA-F]{40}$/.test(builder) && !/^0x0{40}$/.test(builder)
  ? (builder as `0x${string}`)
  : null;

/** Builder fee charged on every fill, in tenths of a basis point (50 = 0.05%). Perps cap is 100. */
export const BUILDER_FEE_TENTHS_BPS = Math.min(100, Math.max(0, Number(env.VITE_BUILDER_FEE_TENTHS_BPS ?? 50)));

/** Max fee rate the user approves once (the perps cap), so the fee can rise later without re-approval. */
export const BUILDER_MAX_FEE_RATE = (env.VITE_BUILDER_MAX_FEE_RATE ?? '0.1%') as `${string}%`;

/** BUILDER_MAX_FEE_RATE expressed in tenths of a basis point, to compare with info.maxBuilderFee. */
export const BUILDER_MAX_FEE_TENTHS_BPS = Math.round(parseFloat(BUILDER_MAX_FEE_RATE) * 1000);

/** Builder fee as a fraction of notional (50 tenths of a bp = 0.0005). */
export const BUILDER_FEE_RATE = BUILDER_FEE_TENTHS_BPS / 100_000;

/** $aura emitted per $1 of builder fee paid (k = 0.5 notional, x1,000 multiplier). */
export const AURA_PER_USD_FEE = 500;

/** Slippage bound used to price market orders and market TP/SL triggers. */
export const MARKET_SLIPPAGE = 0.03;
export const TRIGGER_SLIPPAGE = 0.1;

/** Name the trading agent is registered under on Hyperliquid. */
export const AGENT_NAME = 'HyperEmpire';
