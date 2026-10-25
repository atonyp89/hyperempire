import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; onClose: () => void; title: string; subtitle: ReactNode; children: ReactNode };

/** Shared frame for building screens (Exchange, Townhall, …): wood title bar, close on ✕, Escape or backdrop. */
export function BuildingModal({ open, onClose, title, subtitle, children }: Props) {
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <div className="modal-title">
            <span id="modal-title" className="title-pixel">{title}</span>
            <span className="muted small">{subtitle}</span>
          </div>
          <button ref={closeRef} type="button" className="btn ghost" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            ✕ CLOSE
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
