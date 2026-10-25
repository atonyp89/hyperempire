import { useState } from 'react';
import type { Market } from '../hooks/useMarkets';
import { fmtPct, fmtPx } from '../lib/format';

type Props = { markets: Market[]; loading: boolean; selected?: string; onSelect: (coin: string) => void; autoFocus?: boolean };

/** Searchable market list; shown in the market dropdown of the Exchange header. */
export function MarketList({ markets, loading, selected, onSelect, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toUpperCase();
  const shown = q ? markets.filter((m) => m.name.toUpperCase().includes(q)) : markets;

  return (
    <div className="market-list">
      <label className="label" htmlFor="market-search">MARKETS</label>
      <input
        id="market-search"
        className="input"
        placeholder="Search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown[0]) onSelect(shown[0].name);
        }}
      />
      <div className="market-rows" role="listbox" aria-label="Markets">
        {loading && <div className="muted pad">Loading…</div>}
        {shown.map((m) => (
          <button
            key={m.name}
            type="button"
            role="option"
            aria-selected={m.name === selected}
            className={`market-row ${m.name === selected ? 'selected' : ''}`}
            onClick={() => onSelect(m.name)}
          >
            <span className="mono strong">{m.name}</span>
            <span className="mono">{fmtPx(m.markPx)}</span>
            <span className={`mono ${m.change24h >= 0 ? 'up' : 'down'}`}>{fmtPct(m.change24h, 1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
