// The Exchange building: the shared building frame around the trading terminal. The terminal sits behind
// its own error boundary, so a trading crash shows a retry inside the frame and the town keeps working.

import { AURA_PER_USD_FEE, BUILDER_FEE_RATE, TradingTerminal } from '../../trading';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';

export function ExchangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BuildingModal
      open={open}
      onClose={onClose}
      title="THE EXCHANGE"
      subtitle={<>Hyperliquid perps · builder fee {(BUILDER_FEE_RATE * 100).toFixed(3)}% · {AURA_PER_USD_FEE} $aura per $1 of fee</>}
    >
      <ErrorBoundary name="trading terminal">
        <TradingTerminal />
      </ErrorBoundary>
    </BuildingModal>
  );
}
