import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { Header } from './components/Header';
import { EmpireScene } from './components/EmpireScene';
import { ExchangeModal } from './components/ExchangeModal';
import { MarketList } from './components/MarketList';
import { MarketHeader } from './components/MarketHeader';
import { OrderPanel } from './components/OrderPanel';
import { AccountTabs } from './components/AccountTabs';
import { useMarkets } from './hooks/useMarkets';
import { useOnboarding } from './hooks/useOnboarding';
import { useFills } from './hooks/useTraderData';
import { captureReferral } from './lib/referral';

const EXCHANGE_HASH = '#exchange';

export function App() {
  const { address } = useConnection();
  const markets = useMarkets();
  const onboarding = useOnboarding(address);
  const fills = useFills(address);
  const [coin, setCoin] = useState('BTC');
  const [referral] = useState(captureReferral);
  // `#exchange` deep-links straight into trading for players who only trade.
  const [exchangeOpen, setExchangeOpen] = useState(() => window.location.hash === EXCHANGE_HASH);

  const openExchange = useCallback(() => {
    setExchangeOpen(true);
    history.replaceState(null, '', EXCHANGE_HASH);
  }, []);
  const closeExchange = useCallback(() => {
    setExchangeOpen(false);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    const onHash = () => setExchangeOpen(window.location.hash === EXCHANGE_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const market = useMemo(() => markets.data?.find((m) => m.name === coin) ?? markets.data?.[0], [markets.data, coin]);
  const auraEarned = useMemo(() => (fills.data ?? []).reduce((sum, f) => sum + f.aura, 0), [fills.data]);

  return (
    <div className="app">
      <Header auraEarned={address ? auraEarned : null} referral={referral} onOpenExchange={openExchange} />
      <EmpireScene onOpenExchange={openExchange} />

      <ExchangeModal open={exchangeOpen} onClose={closeExchange}>
        <div className="layout">
          <aside className="panel markets">
            <MarketList markets={markets.data ?? []} loading={markets.isLoading} selected={market?.name} onSelect={setCoin} />
          </aside>
          <section className="center">
            <div className="panel">
              {market ? <MarketHeader market={market} /> : <div className="muted pad">{markets.error ? 'Could not load markets.' : 'Loading markets…'}</div>}
            </div>
            <div className="panel grow">
              <AccountTabs user={address} markets={markets.data ?? []} trader={onboarding.trader} fills={fills.data ?? []} />
            </div>
          </section>
          <aside className="panel order">
            <OrderPanel market={market} user={address} onboarding={onboarding} />
          </aside>
        </div>
      </ExchangeModal>
    </div>
  );
}
