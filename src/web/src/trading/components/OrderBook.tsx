// Order book, laid out like Hyperliquid's: asks on top (highest first), the spread, then bids, each row with
// price, size and cumulative total over a depth bar. Clicking a row hands its price to the order form.

import { useState } from 'react';
import type { Market } from '../hooks/useMarkets';
import { useBook } from '../hooks/useTraderData';
import { fmtNum, fmtPx } from '../../shared/format';

/** Levels shown on each side. */
const DEPTH = 12;

type Row = { px: number; sz: number; total: number };

/** Rows from the best level outward, with the running total in the chosen unit. */
function withTotals(levels: { px: number; sz: number }[], inUsd: boolean): Row[] {
  let total = 0;
  return levels.slice(0, DEPTH).map((l) => {
    const sz = inUsd ? l.sz * l.px : l.sz;
    total += sz;
    return { px: l.px, sz, total };
  });
}

export function OrderBook({ market, onPick }: { market: Market; onPick: (px: number) => void }) {
  const book = useBook(market.name, true);
  const [inUsd, setInUsd] = useState(false);
  const asks = withTotals(book.data?.asks ?? [], inUsd);
  const bids = withTotals(book.data?.bids ?? [], inUsd);
  const maxTotal = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0) || 1;
  const bestAsk = asks[0]?.px;
  const bestBid = bids[0]?.px;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  const unit = inUsd ? 'USD' : market.name;
  const fmtSz = (n: number) => (inUsd ? fmtNum(n, 0) : fmtNum(n, market.szDecimals));

  const row = (r: Row, side: 'ask' | 'bid') => (
    <button
      key={`${side}${r.px}`}
      type="button"
      className={`ob-row ${side}`}
      title={`Use ${fmtPx(r.px)} as the limit price`}
      onClick={() => onPick(r.px)}
    >
      <span className="ob-bar" style={{ width: `${(r.total / maxTotal) * 100}%` }} aria-hidden="true" />
      <span className="mono ob-px">{fmtPx(r.px)}</span>
      <span className="mono">{fmtSz(r.sz)}</span>
      <span className="mono">{fmtSz(r.total)}</span>
    </button>
  );

  return (
    <div className="order-book">
      <div className="ob-head">
        <span className="label">ORDER BOOK</span>
        <div className="ob-unit" role="group" aria-label="Size unit">
          <button type="button" className={!inUsd ? 'on' : ''} aria-pressed={!inUsd} onClick={() => setInUsd(false)}>{market.name}</button>
          <button type="button" className={inUsd ? 'on' : ''} aria-pressed={inUsd} onClick={() => setInUsd(true)}>USD</button>
        </div>
      </div>
      <div className="ob-cols label">
        <span>PRICE</span>
        <span>SIZE ({unit})</span>
        <span>TOTAL ({unit})</span>
      </div>
      {book.isLoading && <div className="muted pad">Loading book…</div>}
      {book.error && <div className="muted pad">Could not load the book.</div>}
      <div className="ob-side asks">{[...asks].reverse().map((r) => row(r, 'ask'))}</div>
      <div className="ob-spread mono">
        <span className="label">SPREAD</span>
        <span>{spread === null ? '—' : fmtPx(spread)}</span>
        <span>{spread === null || !bestBid ? '' : `${((spread / bestBid) * 100).toFixed(3)}%`}</span>
      </div>
      <div className="ob-side bids">{bids.map((r) => row(r, 'bid'))}</div>
    </div>
  );
}
