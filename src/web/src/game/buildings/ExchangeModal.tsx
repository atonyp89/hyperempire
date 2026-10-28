// The Exchange building: the shared building frame around the trading terminal, plus the Exchange Mastery tab.
// The terminal sits behind its own error boundary, so a trading crash shows a retry inside the frame and the town
// keeps working. The game connects the terminal to Exchange rewards: today's $aura pool, shared by builder fees.

import { useState } from 'react';
import { TradingTerminal } from '../../trading';
import { fmtAura, fmtUsd } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { useExchangeRewards } from '../hooks/useExchangeRewards';
import { ExchangeMastery } from './ExchangeMastery';

type Tab = 'trade' | 'mastery';

export function ExchangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { view, rewards } = useExchangeRewards();
  const [tab, setTab] = useState<Tab>('trade');
  const hoursLeft = view ? Math.max(0, Math.ceil((view.endsAt - Date.now()) / 3_600_000)) : null;
  return (
    <BuildingModal
      open={open}
      onClose={onClose}
      title="THE EXCHANGE"
      subtitle={
        <>
          Hyperliquid perps · builder fee {((view?.feeTenthsBps ?? 50) / 1000).toFixed(3)}% · today’s pool{' '}
          {view ? (
            <>
              {fmtAura(view.emission)} $aura, {hoursLeft}h left · fees today {fmtUsd(view.totalFees, 2)} · yours {fmtUsd(view.yourFees, 2)} ≈{' '}
              {fmtAura(view.yourEstimate)} $aura
            </>
          ) : (
            <>of $aura shared by builder fees (sign in to join)</>
          )}
        </>
      }
    >
      <div className="game">
        <div className="ex-tabs" role="tablist" aria-label="Exchange">
          {(['trade', 'mastery'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`ex-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'trade' ? 'TRADE' : 'MASTERY'}
            </button>
          ))}
        </div>
      </div>
      {/* The terminal stays mounted on the Mastery tab, so the order form keeps what you typed. */}
      <div hidden={tab !== 'trade'}>
        <ErrorBoundary name="trading terminal">
          <TradingTerminal rewards={rewards} />
        </ErrorBoundary>
      </div>
      {tab === 'mastery' && (
        <ErrorBoundary name="Exchange Mastery">
          <ExchangeMastery />
        </ErrorBoundary>
      )}
    </BuildingModal>
  );
}
