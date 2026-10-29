// The Garden's 4x4 field: the fenced lawn (public/empire/garden/field.png, built by design/scene/garden/field.py)
// with one button per plot over it. An empty plot plants the selected seed, a ripe one harvests; a growing one
// shows how long is left.

import type { CSSProperties } from 'react';
import { CROPS, GARDEN_COLS, type GardenPlotView } from '@server/contract';

/** The field image's layout, in its native pixels; field.py draws it with the same numbers. */
export const GARDEN_FIELD = { w: 134, h: 146, plot: 24, step: 30, x0: 10, y0: 16 } as const;
/** Crop frames are 16x16; the mound's bottom row is 14, set this far up from the plot's bottom edge. */
const FRAME = 16;
const FEET_UP = 5;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** "2m 05s" until `ms` from now. */
export const timeLeft = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

type Props = {
  plots: GardenPlotView[];
  now: number;
  /** The seed an empty plot plants; null when the player has none picked. */
  seedName: string | null;
  onPlant: (slot: number) => void;
  onHarvest: (slot: number) => void;
};

export function GardenField({ plots, now, seedName, onPlant, onHarvest }: Props) {
  const { w, h, plot, step, x0, y0 } = GARDEN_FIELD;
  return (
    <div className="garden-field" style={{ aspectRatio: `${w} / ${h}` }}>
      <img className="garden-field-img" src="/empire/garden/field.png" alt="" aria-hidden="true" />
      {plots.map((p) => {
        const col = p.slot % GARDEN_COLS;
        const row = Math.floor(p.slot / GARDEN_COLS);
        const box: CSSProperties = { left: pct(x0 + col * step, w), top: pct(y0 + row * step, h), width: pct(plot, w), height: pct(plot, h) };
        const crop = p.crop ? CROPS[p.crop] : null;
        const left = p.readyAt != null ? p.readyAt - now : 0;
        const progress = p.plantedAt != null && p.readyAt != null ? Math.min(1, (now - p.plantedAt) / (p.readyAt - p.plantedAt)) : 0;
        const label = !crop
          ? seedName
            ? `Plot ${p.slot + 1}: empty. Plant ${seedName}.`
            : `Plot ${p.slot + 1}: empty. Buy or pick a seed to plant.`
          : p.ripe
            ? `Plot ${p.slot + 1}: ${crop.name} is ripe. Harvest.`
            : `Plot ${p.slot + 1}: ${crop.name} growing, ripe in ${timeLeft(left)}.`;
        const act = !crop ? (seedName ? () => onPlant(p.slot) : undefined) : p.ripe ? () => onHarvest(p.slot) : undefined;
        return (
          <button
            key={p.slot}
            type="button"
            className={`plot ${crop ? (p.ripe ? 'ripe' : 'growing') : 'empty'}`}
            style={box}
            disabled={!act}
            onClick={act}
            title={label}
            aria-label={label}
          >
            {crop && (
              <span
                className={`crop stage-${p.stage}`}
                style={{
                  left: pct((plot - FRAME) / 2, plot),
                  top: pct(plot - FEET_UP - 14, plot),
                  width: pct(FRAME, plot),
                  height: pct(FRAME, plot),
                  backgroundImage: `url(${crop.sprite})`,
                  backgroundSize: `${crop.stages * 100}% 100%`,
                  backgroundPositionX: `${(p.stage / (crop.stages - 1)) * 100}%`,
                }}
              />
            )}
            {crop && !p.ripe && (
              <span className="plot-bar" aria-hidden="true">
                <span style={{ width: `${progress * 100}%` }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
