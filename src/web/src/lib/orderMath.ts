// Order-form math, kept pure so it can be tested: TP/SL from a target gain, liquidation and slippage estimates.

/** One side of the order book: [price, size] levels, best first. */
export type BookSide = { px: number; sz: number }[];

/**
 * TP/SL price for a target return on margin (ROE, in %) at a leverage.
 * A long's take profit is above the entry and its stop loss below; a short's is the other way round.
 */
export function priceForRoe(entry: number, roePct: number, leverage: number, isLong: boolean, kind: 'tp' | 'sl'): number {
  const move = roePct / 100 / leverage;
  const up = (kind === 'tp') === isLong;
  return entry * (up ? 1 + move : 1 - move);
}

/** Return on margin (in %, always positive) of moving from the entry to `px` at a leverage. */
export function roeForPrice(entry: number, px: number, leverage: number): number {
  if (entry <= 0) return 0;
  return (Math.abs(px - entry) / entry) * leverage * 100;
}

/**
 * Rough liquidation price for a new position. Liquidation comes when losses eat the collateral backing the
 * position down to the maintenance margin. Maintenance is half the initial margin at max leverage,
 * 1 / (2 · maxLeverage) of the notional.
 * - Isolated: the collateral is the position's margin, notional / leverage.
 * - Cross: the account's free collateral also backs it, so `freeUsd` is added.
 * Returns null when there's no size, or when the collateral covers any move toward zero.
 */
export function estLiquidationPx(o: {
  px: number;
  size: number;
  isLong: boolean;
  leverage: number;
  maxLeverage: number;
  isCross: boolean;
  freeUsd: number;
}): number | null {
  const notional = o.px * o.size;
  if (notional <= 0 || o.leverage <= 0) return null;
  const collateral = notional / o.leverage + (o.isCross ? Math.max(0, o.freeUsd) : 0);
  const mmr = 1 / (2 * o.maxLeverage);
  const room = collateral / notional - mmr;
  if (room <= 0) return o.px;
  const liq = o.px * (o.isLong ? 1 - room : 1 + room);
  return liq > 0 ? liq : null;
}

/**
 * Average fill price of a market order of `size` against the book side it takes from (asks for a buy, bids
 * for a sell), and its slippage from the mid in %. Returns null when the book is too thin for the size.
 */
export function estSlippage(levels: BookSide, size: number, mid: number): { avgPx: number; pct: number } | null {
  if (size <= 0 || mid <= 0) return { avgPx: mid, pct: 0 };
  let left = size;
  let cost = 0;
  for (const l of levels) {
    const take = Math.min(left, l.sz);
    cost += take * l.px;
    left -= take;
    if (left <= 1e-12) break;
  }
  if (left > 1e-12) return null;
  const avgPx = cost / size;
  return { avgPx, pct: (Math.abs(avgPx - mid) / mid) * 100 };
}
