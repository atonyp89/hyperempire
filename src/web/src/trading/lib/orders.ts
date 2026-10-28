// Order actions. Every order carries the HyperEmpire builder code, which is what earns $aura.

import type { ExchangeClient } from '@nktkas/hyperliquid';
import type { OrderParameters } from '@nktkas/hyperliquid/api/exchange';
import { BUILDER_ADDRESS, BUILDER_FEE_TENTHS_BPS, MARKET_SLIPPAGE, TRIGGER_SLIPPAGE } from '../config';
import type { Market } from '../hooks/useMarkets';
import { fmtNum } from '../../shared/format';
import { info } from './hl';
import { formatPrice, formatSize } from './prices';

type OrderSpec = OrderParameters['orders'][number];

export type OrderInput = {
  market: Market;
  isBuy: boolean;
  kind: 'market' | 'limit';
  /** Time in force for a limit order: good till cancel, immediate or cancel, or add liquidity only (post-only). */
  tif?: 'Gtc' | 'Ioc' | 'Alo';
  /** Size in coin units. */
  size: number;
  limitPx?: number;
  reduceOnly: boolean;
  takeProfit?: number;
  stopLoss?: number;
  /** The player's builder fee after their Exchange Mastery discount (tenths of a bp). Defaults to the list rate. */
  builderFeeTenths?: number;
};

/** Our builder code, at the player's fee (tenths of a basis point; never above the list rate). */
function builder(feeTenths = BUILDER_FEE_TENTHS_BPS) {
  if (!BUILDER_ADDRESS) throw new Error('Builder address is not configured (VITE_BUILDER_ADDRESS).');
  return { b: BUILDER_ADDRESS, f: Math.max(0, Math.min(BUILDER_FEE_TENTHS_BPS, Math.round(feeTenths))) };
}

/** Price for an aggressive order that crosses the book by MARKET_SLIPPAGE. */
const marketPx = (m: Market, isBuy: boolean) => m.midPx * (isBuy ? 1 + MARKET_SLIPPAGE : 1 - MARKET_SLIPPAGE);

function triggerOrder(m: Market, closeIsBuy: boolean, size: string, triggerPx: number, tpsl: 'tp' | 'sl'): OrderSpec {
  const limit = triggerPx * (closeIsBuy ? 1 + TRIGGER_SLIPPAGE : 1 - TRIGGER_SLIPPAGE);
  return {
    a: m.asset,
    b: closeIsBuy,
    p: formatPrice(limit, m.szDecimals),
    s: size,
    r: true,
    t: { trigger: { isMarket: true, triggerPx: formatPrice(triggerPx, m.szDecimals), tpsl } },
  };
}

/** What an order action returns: a human summary, and the ids of the orders it created (for $aura). */
export type Placed = { text: string; oids: number[]; hasTriggers: boolean };

type Statuses = Awaited<ReturnType<ExchangeClient['order']>>['response']['data']['statuses'];

function placed(statuses: Statuses): Placed {
  const oids: number[] = [];
  for (const s of statuses) {
    if (typeof s === 'string') continue;
    if ('filled' in s) oids.push(s.filled.oid);
    else if ('resting' in s) oids.push(s.resting.oid);
  }
  return { text: describe(statuses), oids, hasTriggers: statuses.some((s) => s === 'waitingForTrigger') };
}

/**
 * Ids of the user's waiting TP/SL orders on this asset. Hyperliquid doesn't return them when placing
 * ("waitingForTrigger"), so they're read back from the open orders.
 */
export async function triggerOids(user: `0x${string}`, coin: string): Promise<number[]> {
  const open = await info.frontendOpenOrders({ user });
  return open.filter((o) => o.coin === coin && o.isTrigger).map((o) => o.oid);
}

/** Human summary of the order statuses Hyperliquid returns. */
function describe(statuses: Statuses): string {
  return statuses
    .map((s) => {
      if (typeof s === 'string') return s === 'waitingForTrigger' ? 'TP/SL set' : 'Waiting for fill';
      if ('filled' in s) return `Filled ${s.filled.totalSz} @ ${fmtNum(Number(s.filled.avgPx), 6)}`;
      // The SDK throws on error statuses, so only success shapes reach here.
      return `Order placed (#${s.resting.oid})`;
    })
    .join(' · ');
}

export async function placeOrder(trader: ExchangeClient, o: OrderInput): Promise<Placed> {
  const m = o.market;
  const size = formatSize(o.size, m.szDecimals);
  if (Number(size) <= 0) throw new Error(`Size rounds to 0 at ${m.szDecimals} decimals.`);
  const px = o.kind === 'market' ? marketPx(m, o.isBuy) : o.limitPx ?? 0;
  if (px <= 0) throw new Error('Enter a price.');

  const orders: OrderSpec[] = [
    {
      a: m.asset,
      b: o.isBuy,
      p: formatPrice(px, m.szDecimals),
      s: size,
      r: o.reduceOnly,
      t: { limit: { tif: o.kind === 'market' ? 'FrontendMarket' : (o.tif ?? 'Gtc') } },
    },
  ];
  if (o.takeProfit) orders.push(triggerOrder(m, !o.isBuy, size, o.takeProfit, 'tp'));
  if (o.stopLoss) orders.push(triggerOrder(m, !o.isBuy, size, o.stopLoss, 'sl'));

  const res = await trader.order({
    orders,
    grouping: orders.length > 1 ? 'normalTpsl' : 'na',
    builder: builder(o.builderFeeTenths),
  });
  return placed(res.response.data.statuses);
}

/** Close a position with a reduce-only market order. `szi` is the signed position size. */
export async function closePosition(trader: ExchangeClient, m: Market, szi: number, builderFeeTenths?: number): Promise<Placed> {
  const isBuy = szi < 0;
  const res = await trader.order({
    orders: [
      {
        a: m.asset,
        b: isBuy,
        p: formatPrice(marketPx(m, isBuy), m.szDecimals),
        s: formatSize(Math.abs(szi), m.szDecimals),
        r: true,
        t: { limit: { tif: 'FrontendMarket' } },
      },
    ],
    grouping: 'na',
    builder: builder(builderFeeTenths),
  });
  return placed(res.response.data.statuses);
}

export async function cancelOrder(trader: ExchangeClient, asset: number, oid: number): Promise<void> {
  await trader.cancel({ cancels: [{ a: asset, o: oid }] });
}

/** Set the leverage and margin mode (cross or isolated) used for this asset's positions. */
export async function setLeverage(trader: ExchangeClient, asset: number, leverage: number, isCross: boolean): Promise<void> {
  await trader.updateLeverage({ asset, isCross, leverage });
}
