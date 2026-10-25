import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { Header } from './components/Header';
import { EmpireScene, type BuildingId } from './components/EmpireScene';
import { ExchangeModal } from './components/ExchangeModal';
import { TownhallModal } from './components/TownhallModal';
import { OrderBook } from './components/OrderBook';
import { MarketHeader } from './components/MarketHeader';
import { OrderPanel, type BookPick } from './components/OrderPanel';
import { AccountTabs } from './components/AccountTabs';
import { useMarkets } from './hooks/useMarkets';
import { useOnboarding } from './hooks/useOnboarding';
import { useFills } from './hooks/useTraderData';
import { useTownhall } from './hooks/useTownhall';
import { useDayPhase } from './hooks/useDayPhase';
import { captureReferral } from './lib/referral';

/** Building screens open from the scene and deep-link by hash (`#exchange`, `#townhall`). */
type Screen = Extract<BuildingId, 'exchange' | 'townhall'> | null;
const screenFromHash = (): Screen => (window.location.hash === '#exchange' ? 'exchange' : window.location.hash === '#townhall' ? 'townhall' : null);

export function App() {
  const { address } = useConnection();
  const markets = useMarkets();
  const onboarding = useOnboarding(address);
  const fills = useFills(address);
  const [coin, setCoin] = useState('BTC');
  const [referral] = useState(captureReferral);
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [pick, setPick] = useState<BookPick | null>(null);

  const open = useCallback((id: BuildingId) => {
    if (id !== 'exchange' && id !== 'townhall') return;
    setScreen(id);
    history.replaceState(null, '', `#${id}`);
  }, []);
  const close = useCallback(() => {
    setScreen(null);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const market = useMemo(() => markets.data?.find((m) => m.name === coin) ?? markets.data?.[0], [markets.data, coin]);
  const auraEarned = useMemo(() => (fills.data ?? []).reduce((sum, f) => sum + f.aura, 0), [fills.data]);
  const townhall = useTownhall(address, auraEarned);
  const day = useDayPhase();

  return (
    <div className="app">
      <Header auraEarned={address ? auraEarned : null} referral={referral} onOpen={open} day={day} />
      <EmpireScene onOpen={open} phase={day.phase} heroActive={screen === null} />

      <TownhallModal open={screen === 'townhall'} onClose={close} townhall={townhall} />

      <ExchangeModal open={screen === 'exchange'} onClose={close}>
        <div className="layout">
          <section className="center">
            <div className="panel">
              {market ? (
                <MarketHeader market={market} markets={markets.data ?? []} loading={markets.isLoading} onSelect={setCoin} />
              ) : (
                <div className="muted pad">{markets.error ? 'Could not load markets.' : 'Loading markets…'}</div>
              )}
            </div>
            <div className="panel grow">
              <AccountTabs user={address} markets={markets.data ?? []} trader={onboarding.trader} fills={fills.data ?? []} />
            </div>
          </section>
          <aside className="panel book">
            {market && <OrderBook market={market} onPick={(px) => setPick({ coin: market.name, px, n: Date.now() })} />}
          </aside>
          <aside className="panel order">
            <OrderPanel market={market} user={address} onboarding={onboarding} pick={pick} />
          </aside>
        </div>
      </ExchangeModal>
    </div>
  );
}
