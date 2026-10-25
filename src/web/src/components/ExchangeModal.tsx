import type { ReactNode } from 'react';
import { BUILDER_FEE_RATE } from '../config';
import { BuildingModal } from './BuildingModal';

export function ExchangeModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <BuildingModal
      open={open}
      onClose={onClose}
      title="THE EXCHANGE"
      subtitle={<>Hyperliquid perps · builder fee {(BUILDER_FEE_RATE * 100).toFixed(3)}% · 500 $aura per $1 of fee</>}
    >
      {children}
    </BuildingModal>
  );
}
