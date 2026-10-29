// A small dialog over a building screen (the Garden's seed shop, a pack's reveal). Escape closes the overlay only,
// not the screen under it; so does a click on the backdrop, or anywhere at all with `closeOnClick`.

import { useEffect, type ReactNode } from 'react';

type Props = { label: string; onClose: () => void; closeOnClick?: boolean; className?: string; children: ReactNode };

export function Overlay({ label, onClose, closeOnClick = false, className = '', children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    // Capture phase, so the building screen's own Escape handler never sees it.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="overlay-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={closeOnClick ? onClose : undefined}
    >
      <div className={`overlay panel ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
