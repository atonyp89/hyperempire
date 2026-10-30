// The Garden scene: a top-down farmyard (public/empire/garden/scene.png) with the fenced 4x4 field at its centre
// (field.png, built by design/scene/garden/field.py, painted around by PixelLab inpaint) and a road the working
// Farmers wander (walkable.png, from design/scene/garden/walkable.py). One button per plot sits over the field. An empty plot plants the selected seed, a ripe one harvests; a growing one
// shows how long is left. A harvest floats "+4" and the item's icon up from each plot it emptied.

import type { CSSProperties } from 'react';
import { CROPS, GARDEN_COLS, type FarmerView, type GardenPlotView } from '@server/contract';
import type { HarvestPop } from '../hooks/useGarden';
import { FarmerWalkers } from '../scene/FarmerWalkers';
import type { HeroScene } from '../scene/Hero';
import { itemInfo } from '../lib/items';

/**
 * The scene's layout, in its native pixels: the field sits at (61, 31) in the 256x208 scene, and field.py draws its
 * plots 24 px wide every 30 px from (10, 16) inside it.
 */
export const GARDEN_FIELD = { w: 256, h: 208, plot: 24, step: 30, x0: 61 + 10, y0: 31 + 16 } as const;

/** The Garden's road for the Farmers who wander it (same shape as the knight's scenes in Hero.tsx). */
export const GARDEN_SCENE: HeroScene = {
  w: GARDEN_FIELD.w,
  h: GARDEN_FIELD.h,
  walkable: '/empire/garden/walkable.png',
  start: { x: 128, y: 200 },
  occluders: [],
};
/** Crop frames are 16x16; the mound's bottom row is 14, set this far up from the plot's bottom edge. */
const FRAME = 16;
const FEET_UP = 5;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** "Rare " before a crop's name, nothing for common. */
const gradeWord = (g: string | null) => (g && g !== 'common' ? `${g[0].toUpperCase()}${g.slice(1)} ` : '');

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
  pops: HarvestPop[];
  /** Farmers working the Garden: they wander the road. */
  farmers: FarmerView[];
};

export function GardenField({ plots, now, seedName, onPlant, onHarvest, pops, farmers }: Props) {
  const { w, h, plot, step, x0, y0 } = GARDEN_FIELD;
  const boxOf = (slot: number): CSSProperties => ({
    left: pct(x0 + (slot % GARDEN_COLS) * step, w),
    top: pct(y0 + Math.floor(slot / GARDEN_COLS) * step, h),
    width: pct(plot, w),
    height: pct(plot, h),
  });
  return (
    <div className="garden-field" style={{ aspectRatio: `${w} / ${h}` }}>
      <div className="world garden-world">
        <img className="garden-field-img" src="/empire/garden/scene.png" alt="" aria-hidden="true" />
        {plots.map((p) => {
          const box = boxOf(p.slot);
          const crop = p.crop ? CROPS[p.crop] : null;
          const left = p.readyAt != null ? p.readyAt - now : 0;
          const progress = p.plantedAt != null && p.readyAt != null ? Math.min(1, (now - p.plantedAt) / (p.readyAt - p.plantedAt)) : 0;
          const label = !crop
            ? seedName
              ? `Plot ${p.slot + 1}: empty. Plant ${seedName}.`
              : `Plot ${p.slot + 1}: empty. Buy or pick a seed to plant.`
            : p.ripe
              ? `Plot ${p.slot + 1}: ${gradeWord(p.grade)}${crop.name} is ripe. Harvest.`
              : `Plot ${p.slot + 1}: ${gradeWord(p.grade)}${crop.name} growing, ripe in ${timeLeft(left)}.`;
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
              {crop && p.grade && p.grade !== 'common' && <span className={`plot-grade grade-${p.grade}`} aria-hidden="true" />}
              {crop && !p.ripe && (
                <span className="plot-bar" aria-hidden="true">
                  <span style={{ width: `${progress * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
        <div className="harvest-pops" role="status">
          {pops.map((p) => {
            const info = itemInfo(p.item);
            return (
              <span key={p.id} className="harvest-pop" style={boxOf(p.slot)} aria-label={`Harvested ${p.qty} ${info.name}`}>
                <span className="harvest-pop-body">
                  +{p.qty}
                  <span className="harvest-pop-icon" style={info.icon} aria-hidden="true" />
                </span>
              </span>
            );
          })}
        </div>
        <FarmerWalkers farmers={farmers} scene={GARDEN_SCENE} />
      </div>
    </div>
  );
}
