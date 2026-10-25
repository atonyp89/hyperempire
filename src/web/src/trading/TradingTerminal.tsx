// The trading terminal: market header and account tabs, order book, order form. It owns its own data
// (markets, wallet onboarding, fills) so whatever hosts it, today the Exchange building, only mounts it.
// Each panel has its own error boundary: if the book breaks, the order form keeps working.

import { useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { AccountTabs } from './components/AccountTabs';
import { MarketHeader } from './components/MarketHeader';
import { OrderBook } from './components/OrderBook';
import { OrderPanel, type BookPick } from './components/OrderPanel';
import { useMarkets } from './hooks/useMarkets';
import { useOnboarding } from './hooks/useOnboarding';
import { useFills } from './hooks/useTraderData';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import './trading.css';

/** The last market viewed, so reopening the Exchange comes back to it. */
const COIN_KEY = 'hyperempire.trade.coin';
const savedCoin = () => {
  try {
    return localStorage.getItem(COIN_KEY) ?? 'BTC';
  } catch {
    return 'BTC';
  }
};

export function TradingTerminal() {
  const { address } = useConnection();
  const markets = useMarkets();
  const onboarding = useOnboarding(address);
  const fills = useFills(address);
  const [coin, setCoin] = useState(savedCoin);
  const [pick, setPick] = useState<BookPick | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COIN_KEY, coin);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }, [coin]);

  const market = useMemo(() => markets.data?.find((m) => m.name === coin) ?? markets.data?.[0], [markets.data, coin]);

  return (
    <div className="trading">
      <div className="layout">
        <section className="center">
          <div className="panel">
            <ErrorBoundary name="market header">
              {market ? (
                <MarketHeader market={market} markets={markets.data ?? []} loading={markets.isLoading} onSelect={setCoin} />
              ) : (
                <div className="muted pad">{markets.error ? 'Could not load markets.' : 'Loading markets…'}</div>
              )}
            </ErrorBoundary>
          </div>
          <div className="panel grow">
            <ErrorBoundary name="account panel">
              <AccountTabs user={address} markets={markets.data ?? []} trader={onboarding.trader} fills={fills.data ?? []} />
            </ErrorBoundary>
          </div>
        </section>
        <aside className="panel book">
          <ErrorBoundary name="order book">
            {market && <OrderBook market={market} onPick={(px) => setPick({ coin: market.name, px, n: Date.now() })} />}
          </ErrorBoundary>
        </aside>
        <aside className="panel order">
          <ErrorBoundary name="order form">
            <OrderPanel market={market} user={address} onboarding={onboarding} pick={pick} />
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
