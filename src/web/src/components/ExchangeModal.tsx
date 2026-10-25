import { useEffect, useRef, type ReactNode } from 'react';
import { BUILDER_FEE_RATE } from '../config';

export function ExchangeModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exchange-title">
        <div className="modal-head">
          <div className="modal-title">
            <span id="exchange-title" className="title-pixel">THE EXCHANGE</span>
            <span className="muted small">
              Hyperliquid perps · builder fee {(BUILDER_FEE_RATE * 100).toFixed(3)}% · 500 $aura per $1 of fee
            </span>
          </div>
          <button ref={closeRef} type="button" className="btn ghost" onClick={onClose} aria-label="Close the Exchange">
            ✕ CLOSE
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
