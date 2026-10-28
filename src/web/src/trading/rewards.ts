// How the trading terminal talks about $aura without knowing the game: whoever hosts the terminal (the Exchange
// building) passes these in. Trading reports the orders it places and asks what a fee would earn; the game
// answers from its own rules (today: a share of the daily $aura pool).

import { createContext, useContext } from 'react';
import { BUILDER_FEE_TENTHS_BPS } from './config';

export type TradingRewards = {
  /** Order ids just placed through the terminal (including TP/SL), so their fees can earn $aura. */
  onOrders: (oids: number[]) => void;
  /** Estimated extra $aura for paying this builder fee (USD) now, or null if unknown (e.g. not signed in). */
  auraForFee: (feeUsd: number) => number | null;
  /** One line on how fees earn $aura, for the setup screen and fills tab. */
  howItWorks: string;
  /** The builder fee to put on orders (tenths of a basis point), after the player's earned discount; null = list rate. */
  feeTenthsBps: number | null;
};

const NONE: TradingRewards = { onOrders: () => {}, auraForFee: () => null, howItWorks: 'Builder fees you pay earn $aura.', feeTenthsBps: null };

export const TradingRewardsContext = createContext<TradingRewards>(NONE);
export const useTradingRewards = () => useContext(TradingRewardsContext);

/** The builder fee this player pays, in tenths of a basis point and as a fraction: the list rate, or less with a discount. */
export function useBuilderFee() {
  const { feeTenthsBps } = useTradingRewards();
  const tenths = feeTenthsBps === null ? BUILDER_FEE_TENTHS_BPS : Math.min(BUILDER_FEE_TENTHS_BPS, feeTenthsBps);
  return { tenths, rate: tenths / 100_000 };
}
