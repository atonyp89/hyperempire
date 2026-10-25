// Composition root: the game (header, scene, Townhall) and the trading terminal (in the Exchange building),
// each behind its own error boundary so one crashing never takes the other down.

import { useCallback, useEffect, useState } from 'react';
import { useConnection } from 'wagmi';
import { Header } from './game/Header';
import { EmpireScene, type BuildingId } from './game/scene/EmpireScene';
import { ExchangeModal } from './game/buildings/ExchangeModal';
import { TownhallModal } from './game/buildings/TownhallModal';
import { useTownhall } from './game/hooks/useTownhall';
import { useDayPhase } from './game/hooks/useDayPhase';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { captureReferral, useAuraEarned } from './trading';
import './game/game.css';

/** Building screens open from the scene and deep-link by hash (`#exchange`, `#townhall`). */
type Screen = Extract<BuildingId, 'exchange' | 'townhall'> | null;
const screenFromHash = (): Screen => (window.location.hash === '#exchange' ? 'exchange' : window.location.hash === '#townhall' ? 'townhall' : null);

export function App() {
  const { address } = useConnection();
  const [referral] = useState(captureReferral);
  const [screen, setScreen] = useState<Screen>(screenFromHash);

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

  const auraEarned = useAuraEarned(address);
  const townhall = useTownhall(address, auraEarned);
  const day = useDayPhase();

  return (
    <div className="app">
      <div className="game">
        <ErrorBoundary name="header">
          <Header auraEarned={address ? auraEarned : null} referral={referral} onOpen={open} day={day} />
        </ErrorBoundary>
        <ErrorBoundary name="town">
          <EmpireScene onOpen={open} phase={day.phase} heroActive={screen === null} />
        </ErrorBoundary>
        <ErrorBoundary name="Townhall">
          <TownhallModal open={screen === 'townhall'} onClose={close} townhall={townhall} />
        </ErrorBoundary>
      </div>
      <ExchangeModal open={screen === 'exchange'} onClose={close} />
    </div>
  );
}
