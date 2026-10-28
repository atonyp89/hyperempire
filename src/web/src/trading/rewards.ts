// How the trading terminal talks about $aura without knowing the game: whoever hosts the terminal (the Exchange
// building) passes these in. Trading reports the orders it places and asks what a fee would earn; the game
// answers from its own rules (today: a share of the daily $aura pool).

import { createContext, useContext } from 'react';

export type TradingRewards = {
  /** Order ids just placed through the terminal (including TP/SL), so their fees can earn $aura. */
  onOrders: (oids: number[]) => void;
  /** Estimated extra $aura for paying this builder fee (USD) now, or null if unknown (e.g. not signed in). */
  auraForFee: (feeUsd: number) => number | null;
  /** One line on how fees earn $aura, for the setup screen and fills tab. */
  howItWorks: string;
};

const NONE: TradingRewards = { onOrders: () => {}, auraForFee: () => null, howItWorks: 'Builder fees you pay earn $aura.' };

export const TradingRewardsContext = createContext<TradingRewards>(NONE);
export const useTradingRewards = () => useContext(TradingRewardsContext);
