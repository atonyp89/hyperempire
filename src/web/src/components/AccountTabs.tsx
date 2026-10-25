import { useState } from 'react';
import type { ExchangeClient } from '@nktkas/hyperliquid';
import { useQueryClient } from '@tanstack/react-query';
import type { Market } from '../hooks/useMarkets';
import { useClearinghouse, useFills, useOpenOrders } from '../hooks/useTraderData';
import { errorMessage } from '../lib/hl';
import { fmtAura, fmtNum, fmtPct, fmtPx, fmtUsd } from '../lib/format';
import { cancelOrder, closePosition } from '../lib/orders';

type Fill = NonNullable<ReturnType<typeof useFills>['data']>[number];
type Props = { user?: `0x${string}`; markets: Market[]; trader: ExchangeClient | null; fills: Fill[] };
type Tab = 'positions' | 'orders' | 'fills';

export function AccountTabs({ user, markets, trader, fills }: Props) {
  const [tab, setTab] = useState<Tab>('positions');
  const [msg, setMsg] = useState<string | null>(null);
  const qc = useQueryClient();
  const ch = useClearinghouse(user);
  const orders = useOpenOrders(user);
  const byName = new Map(markets.map((m) => [m.name, m]));

  const positions = (ch.data?.assetPositions ?? []).map((p) => p.position).filter((p) => Number(p.szi) !== 0);
  const refresh = () => qc.invalidateQueries({ predicate: (q) => ['clearinghouse', 'openOrders', 'fills'].includes(String(q.queryKey[0])) });

  async function run(fn: () => Promise<unknown>) {
    setMsg(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  if (!user) return <div className="muted pad">Connect a wallet to see positions, orders and $aura earned.</div>;

  const totalAura = fills.reduce((s, f) => s + f.aura, 0);
  const summary = ch.data?.marginSummary;

  return (
    <div className="account">
      <div className="account-top">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'positions'} onClick={() => setTab('positions')}>POSITIONS ({positions.length})</button>
          <button type="button" role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>OPEN ORDERS ({orders.data?.length ?? 0})</button>
          <button type="button" role="tab" aria-selected={tab === 'fills'} onClick={() => setTab('fills')}>FILLS · $AURA</button>
        </div>
        {summary && (
          <div className="summary mono small">
            <span>Account {fmtUsd(Number(summary.accountValue))}</span>
            <span>Withdrawable {fmtUsd(Number(ch.data?.withdrawable ?? 0))}</span>
          </div>
        )}
      </div>
      {msg && <div className="notice err">{msg}</div>}

      <div className="table-wrap">
        {tab === 'positions' && (
          <table>
            <thead><tr><th>Market</th><th>Size</th><th>Entry</th><th>Value</th><th>PnL (ROE)</th><th>Liq.</th><th /></tr></thead>
            <tbody>
              {positions.length === 0 && <tr><td colSpan={7} className="muted">No open positions.</td></tr>}
              {positions.map((p) => {
                const szi = Number(p.szi);
                const pnl = Number(p.unrealizedPnl);
                const m = byName.get(p.coin);
                return (
                  <tr key={p.coin}>
                    <td className="strong">{p.coin} <span className={szi > 0 ? 'up' : 'down'}>{szi > 0 ? 'LONG' : 'SHORT'} {p.leverage.value}x</span></td>
                    <td className="mono">{fmtNum(Math.abs(szi), 6)}</td>
                    <td className="mono">{fmtPx(Number(p.entryPx))}</td>
                    <td className="mono">{fmtUsd(Number(p.positionValue))}</td>
                    <td className={`mono ${pnl >= 0 ? 'up' : 'down'}`}>{fmtUsd(pnl)} ({fmtPct(Number(p.returnOnEquity) * 100, 1)})</td>
                    <td className="mono">{p.liquidationPx ? fmtPx(Number(p.liquidationPx)) : '—'}</td>
                    <td>
                      <button type="button" className="btn ghost small" disabled={!trader || !m} onClick={() => trader && m && run(() => closePosition(trader, m, szi))}>
                        CLOSE
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'orders' && (
          <table>
            <thead><tr><th>Market</th><th>Type</th><th>Side</th><th>Price</th><th>Size</th><th /></tr></thead>
            <tbody>
              {(orders.data ?? []).length === 0 && <tr><td colSpan={6} className="muted">No open orders.</td></tr>}
              {(orders.data ?? []).map((o) => {
                const m = byName.get(o.coin);
                return (
                  <tr key={o.oid}>
                    <td className="strong">{o.coin}</td>
                    <td>{o.orderType}{o.reduceOnly ? ' · RO' : ''}</td>
                    <td className={o.side === 'B' ? 'up' : 'down'}>{o.side === 'B' ? 'BUY' : 'SELL'}</td>
                    <td className="mono">{fmtPx(Number(o.isTrigger ? o.triggerPx : o.limitPx))}</td>
                    <td className="mono">{o.sz}</td>
                    <td>
                      <button type="button" className="btn ghost small" disabled={!trader || !m} onClick={() => trader && m && run(() => cancelOrder(trader, m.asset, o.oid))}>
                        CANCEL
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'fills' && (
          <>
            <div className="aura-total">
              <span className="gem" aria-hidden="true" /> {fmtAura(totalAura)} $aura earned from builder fees
              <span className="muted small"> · estimate until the epoch is settled and claimable</span>
            </div>
            <table>
              <thead><tr><th>Time</th><th>Market</th><th>Direction</th><th>Price</th><th>Size</th><th>Builder fee</th><th>$aura</th></tr></thead>
              <tbody>
                {fills.length === 0 && <tr><td colSpan={7} className="muted">No fills yet. Every fill through HyperHero earns $aura.</td></tr>}
                {fills.slice(0, 100).map((f) => (
                  <tr key={`${f.tid}-${f.oid}`}>
                    <td className="mono small">{new Date(f.time).toLocaleString()}</td>
                    <td className="strong">{f.coin}</td>
                    <td>{f.dir}</td>
                    <td className="mono">{fmtPx(Number(f.px))}</td>
                    <td className="mono">{f.sz}</td>
                    <td className="mono">{f.builderFeeUsd > 0 ? fmtUsd(f.builderFeeUsd, 4) : '—'}</td>
                    <td className="mono aura">{f.aura > 0 ? `+${fmtAura(f.aura)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
