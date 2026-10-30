// Composition root: the game (header, scene, Townhall, Garden, Tavern) and the trading terminal (in the Exchange building),
// each behind its own error boundary so one crashing never takes the other down.

import { useCallback, useEffect, useState } from 'react';
import { Header } from './game/Header';
import { EmpireScene, type BuildingId } from './game/scene/EmpireScene';
import { ExchangeModal } from './game/buildings/ExchangeModal';
import { GardenModal } from './game/buildings/GardenModal';
import { TavernModal } from './game/buildings/TavernModal';
import { TownhallModal } from './game/buildings/TownhallModal';
import { useTownhall } from './game/hooks/useTownhall';
import { useDayPhase } from './game/hooks/useDayPhase';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { captureReferral } from './trading';
import './game/game.css';

/** Building screens open from the scene and deep-link by hash (`#exchange`, `#townhall`, `#garden`, `#tavern`). */
const SCREENS = ['exchange', 'townhall', 'garden', 'tavern'] as const;
type Screen = Extract<BuildingId, (typeof SCREENS)[number]> | null;
const isScreen = (v: string): v is NonNullable<Screen> => (SCREENS as readonly string[]).includes(v);
const screenFromHash = (): Screen => {
  const h = window.location.hash.slice(1);
  return isScreen(h) ? h : null;
};

export function App() {
  const [referral] = useState(captureReferral);
  const [screen, setScreen] = useState<Screen>(screenFromHash);

  const open = useCallback((id: BuildingId) => {
    if (!isScreen(id)) return;
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

  const townhall = useTownhall();
  const day = useDayPhase();

  return (
    <div className="app">
      <div className="game">
        <ErrorBoundary name="header">
          <Header referral={referral} onOpen={open} day={day} />
        </ErrorBoundary>
        <ErrorBoundary name="town">
          <EmpireScene onOpen={open} phase={day.phase} heroActive={screen === null} />
        </ErrorBoundary>
        <ErrorBoundary name="Townhall">
          <TownhallModal open={screen === 'townhall'} onClose={close} townhall={townhall} />
        </ErrorBoundary>
        <ErrorBoundary name="Garden">
          <GardenModal open={screen === 'garden'} onClose={close} />
        </ErrorBoundary>
        <ErrorBoundary name="Tavern">
          <TavernModal open={screen === 'tavern'} onClose={close} />
        </ErrorBoundary>
      </div>
      <ExchangeModal open={screen === 'exchange'} onClose={close} />
    </div>
  );
}
