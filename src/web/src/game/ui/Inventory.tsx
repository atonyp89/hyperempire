// Inventory grid: square slots, one item stack per slot with its count in the corner, empty slots as sockets.
// 10 columns, 6 on narrow screens (game.css); the grid always shows at least `slots` slots (30 fills both evenly)
// and adds rows as stacks need them. Stacks `actionOf` names an action for are buttons ("pick", "open"), and the
// picked one is outlined (the Garden picks seeds and opens packs this way). A graded item's slot takes its grade's
// colour. A stack whose count goes up gives a short bump, so a harvest is easy to see.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fmtAura } from '../../shared/format';
import { itemInfo } from '../lib/items';

export type Stack = { id: string; qty: number };

type Props = {
  stacks: Stack[];
  slots?: number;
  label: string;
  picked?: string | null;
  /** What clicking a stack does ("pick", "open"), or null when it does nothing. */
  actionOf?: (id: string) => string | null;
  onPick?: (id: string) => void;
};

/** Rows always fill for both column counts. */
const ROW = 30;

export function Inventory({ stacks, slots = 30, label, picked, actionOf, onPick }: Props) {
  const total = Math.max(slots, Math.ceil(stacks.length / ROW) * ROW);
  const bumped = useBumps(stacks);
  return (
    <div className="inv-grid" role="list" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const s = stacks[i];
        if (!s) return <div key={`empty-${i}`} className="inv-slot empty" role="listitem" aria-label="Empty slot" />;
        const info = itemInfo(s.id);
        const action = onPick ? (actionOf?.(s.id) ?? null) : null;
        const pickable = !!action;
        const cls = `${bumped.has(s.id) ? 'bump' : ''} ${s.id === picked ? 'on' : ''} ${pickable ? 'pickable' : ''} ${info.grade ? `grade-${info.grade}` : ''}`;
        return (
          <ItemSlot
            key={s.id}
            icon={info.icon}
            className={cls}
            title={`${info.name} × ${fmtAura(s.qty)}${s.id === picked ? ' (picked)' : action ? `. Click to ${action}.` : ''}`}
            role="listitem"
            onClick={action && onPick ? () => onPick(s.id) : undefined}
            pressed={action === 'pick' ? s.id === picked : undefined}
          >
            <span className="inv-qty">{s.qty > 999 ? `${Math.floor(s.qty / 1000)}k` : s.qty}</span>
          </ItemSlot>
        );
      })}
    </div>
  );
}

type SlotProps = {
  icon: CSSProperties;
  title: string;
  className?: string;
  role?: string;
  /** Makes the slot a button. */
  onClick?: () => void;
  pressed?: boolean;
  children?: ReactNode;
};

/** One square slot with an item's icon; children go on top (a count, a price). */
export function ItemSlot({ icon, title, className = '', role, onClick, pressed, children }: SlotProps) {
  if (onClick) {
    return (
      <div role={role} className="inv-cell">
        <button type="button" className={`inv-slot ${className}`} title={title} aria-label={title} aria-pressed={pressed} onClick={onClick}>
          <span className="inv-icon" style={icon} aria-hidden="true" />
          {children}
        </button>
      </div>
    );
  }
  return (
    <div className={`inv-slot ${className}`} title={title} aria-label={title} role={role}>
      <span className="inv-icon" style={icon} aria-hidden="true" />
      {children}
    </div>
  );
}

/** Ids whose count rose since the last render, for ~600 ms. */
function useBumps(stacks: Stack[]) {
  const prev = useRef<Map<string, number> | null>(null);
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    prev.current = new Map(stacks.map((s) => [s.id, s.qty]));
    if (!before) return;
    const up = stacks.filter((s) => s.qty > (before.get(s.id) ?? 0)).map((s) => s.id);
    if (!up.length) return;
    setBumped(new Set(up));
    const t = window.setTimeout(() => setBumped(new Set()), 600);
    return () => window.clearTimeout(t);
  }, [stacks]);
  return bumped;
}
