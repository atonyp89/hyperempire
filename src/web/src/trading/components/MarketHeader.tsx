import { useEffect, useRef, useState } from 'react';
import type { Market } from '../hooks/useMarkets';
import { useCandles } from '../hooks/useMarkets';
import { fmtPct, fmtPx, fmtUsd } from '../../shared/format';
import { MarketList } from './MarketList';

type Props = { market: Market; markets: Market[]; loading: boolean; onSelect: (coin: string) => void };

export function MarketHeader({ market, markets, loading, onSelect }: Props) {
  const candles = useCandles(market.name);
  return (
    <div className="market-header">
      <div className="mh-title">
        <MarketPicker market={market} markets={markets} loading={loading} onSelect={onSelect} />
        <span className="mono big">{fmtPx(market.markPx)}</span>
        <span className={`mono ${market.change24h >= 0 ? 'up' : 'down'}`}>{fmtPct(market.change24h)}</span>
      </div>
      <dl className="stats">
        <div><dt>24H VOLUME</dt><dd className="mono">{fmtUsd(market.dayNtlVlm, 0)}</dd></div>
        <div><dt>OPEN INTEREST</dt><dd className="mono">{fmtUsd(market.openInterest, 0)}</dd></div>
        <div><dt>FUNDING / 1H</dt><dd className={`mono ${market.funding >= 0 ? 'up' : 'down'}`}>{(market.funding * 100).toFixed(4)}%</dd></div>
        <div><dt>MAX LEVERAGE</dt><dd className="mono">{market.maxLeverage}x</dd></div>
      </dl>
      <Sparkline points={candles.data?.map((c) => c.c) ?? []} up={market.change24h >= 0} />
    </div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <div className="spark muted pad">Loading chart…</div>;
  const w = 600;
  const h = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - ((p - min) / span) * (h - 8) - 4).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Price over the last 24 hours">
      <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The market name as a dropdown button: opens the searchable market list in a popover. */
function MarketPicker({ market, markets, loading, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', away);
    return () => window.removeEventListener('mousedown', away);
  }, [open]);
  return (
    <div
      className="market-picker"
      ref={root}
      onKeyDown={(e) => {
        // Escape closes the dropdown only, not the whole Exchange.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className="coin picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {market.name}-PERP <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="picker-pop">
          <MarketList
            markets={markets}
            loading={loading}
            selected={market.name}
            autoFocus
            onSelect={(coin) => {
              onSelect(coin);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
