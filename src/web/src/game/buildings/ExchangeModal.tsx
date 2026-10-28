// The Exchange building: the shared building frame around the trading terminal. The terminal sits behind
// its own error boundary, so a trading crash shows a retry inside the frame and the town keeps working.
// The game connects the terminal to Exchange rewards: today's $aura pool, shared by builder fees.

import { BUILDER_FEE_RATE, TradingTerminal } from '../../trading';
import { fmtAura, fmtUsd } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { useExchangeRewards } from '../hooks/useExchangeRewards';

export function ExchangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { view, rewards } = useExchangeRewards();
  const hoursLeft = view ? Math.max(0, Math.ceil((view.endsAt - Date.now()) / 3_600_000)) : null;
  return (
    <BuildingModal
      open={open}
      onClose={onClose}
      title="THE EXCHANGE"
      subtitle={
        <>
          Hyperliquid perps · builder fee {(BUILDER_FEE_RATE * 100).toFixed(3)}% · today’s pool{' '}
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
      <ErrorBoundary name="trading terminal">
        <TradingTerminal rewards={rewards} />
      </ErrorBoundary>
    </BuildingModal>
  );
}
