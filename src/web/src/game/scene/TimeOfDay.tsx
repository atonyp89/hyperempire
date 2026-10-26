// Time-of-day layers over the Empire scene: a morning grade with sunbeams, motes and sun glints on the pools,
// a night tint with a moonpath on the pools, moonlight, lit windows,
// lamp and doorway glows, and fireflies. All layers stay mounted and fade with opacity, so
// switching phase is a smooth transition.

import type { CSSProperties } from 'react';
import type { Phase } from '../hooks/useDayPhase';
import { WORLD_H, WORLD_W } from './world';

const at = (x: number, y: number, r: number): CSSProperties => ({
  left: `${((x - r) / WORLD_W) * 100}%`,
  top: `${((y - r) / WORLD_H) * 100}%`,
  width: `${((2 * r) / WORLD_W) * 100}%`,
  height: `${((2 * r) / WORLD_H) * 100}%`,
});

/** Warm light pools at night: [x, y, radius] in native scene pixels. */
const GLOWS: { x: number; y: number; r: number; kind: 'lamp' | 'door' | 'window' }[] = [
  { x: 255.5, y: 70, r: 16, kind: 'lamp' },
  { x: 452.5, y: 108, r: 16, kind: 'lamp' },
  { x: 297, y: 176, r: 15, kind: 'lamp' },
  { x: 316, y: 80, r: 20, kind: 'door' },
  { x: 438, y: 76, r: 16, kind: 'door' },
  { x: 190, y: 72, r: 12, kind: 'window' },
  { x: 217, y: 72, r: 9, kind: 'window' },
  { x: 316, y: 57, r: 7, kind: 'window' },
  // Mine: shaft entrance and the lantern post beside it.
  { x: 610, y: 155, r: 12, kind: 'door' },
  { x: 625, y: 156, r: 6, kind: 'window' },
  // Workshop (east strip): door and gable window.
  { x: 568, y: 74, r: 14, kind: 'door' },
  { x: 567, y: 51, r: 7, kind: 'window' },
];

/** Pool water boxes in native scene pixels (x0, y0, x1, y1); glints are clipped to them. */
const POOLS = [
  { x0: 261, y0: 108, x1: 295, y1: 153 },
  { x0: 341, y0: 108, x1: 375, y1: 153 },
];
/**
 * Light on the pool water. Top-down, water shows glints, not a mirrored disc: short streaks that
 * twinkle on the ripples. Morning: warm glints scattered, denser toward the sun (top-left).
 * Night: fewer silver glints in a broken vertical moonpath. Deterministic so every load matches.
 */
type Glint = { x: number; y: number; w: number; d: number };
function glints(seed: number, count: number, place: (r: () => number) => { x: number; y: number }): Glint[] {
  let t = seed;
  const r = () => ((t = (t * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () => ({ ...place(r), w: 2 + Math.floor(r() * 4), d: -r() * 3 }));
}
const POOL_W = 34;
const POOL_H = 45;
const SUN_GLINTS = POOLS.map((_, i) =>
  glints(11 + i * 7, 11, (r) => ({ x: Math.floor(Math.pow(r(), 1.6) * (POOL_W - 6)) + 1, y: Math.floor(Math.pow(r(), 1.3) * (POOL_H - 16)) + 8 })),
);
const MOON_GLINTS = POOLS.map((_, i) =>
  glints(5 + i * 13, 7, (r) => ({ x: 17 + Math.floor((r() - 0.5) * 8) + i * 3, y: 10 + Math.floor(r() * (POOL_H - 22)) })),
);

const box = (x: number, y: number, w: number, h: number, inW: number, inH: number): CSSProperties => ({
  left: `${(x / inW) * 100}%`,
  top: `${(y / inH) * 100}%`,
  width: `${(w / inW) * 100}%`,
  height: `${(h / inH) * 100}%`,
});

/** Dust motes drifting through the morning sunbeams. */
const MOTES = [
  { x: 190, y: 18, d: 0 },
  { x: 230, y: 8, d: -2.2 },
  { x: 278, y: 26, d: -4.5 },
  { x: 208, y: 50, d: -6.1 },
  { x: 310, y: 12, d: -3.3 },
  { x: 252, y: 40, d: -7.4 },
];

const FIREFLIES = [
  { x: 260, y: 50, d: 0 },
  { x: 246, y: 58, d: -1.4 },
  { x: 410, y: 128, d: -0.6 },
  { x: 422, y: 92, d: -2.1 },
  { x: 200, y: 140, d: -1.1 },
  { x: 230, y: 160, d: -2.6 },
  { x: 470, y: 130, d: -0.3 },
];

export function TimeOfDay({ phase }: { phase: Phase }) {
  return (
    <div className={`tod tod-${phase}`} aria-hidden="true">
      <div className="tod-wash-morning" />
      <div className="tod-sun" />
      <div className="tod-rays" />
      {MOTES.map((m, i) => (
        <span key={`m${i}`} className="mote" style={{ ...at(m.x, m.y, 0.5), animationDelay: `${m.d}s` }} />
      ))}
      <div className="tod-wash-night" />
      <img className="tod-lights" src="/empire/night-lights.png" alt="" />
      {GLOWS.map((g, i) => (
        <span key={i} className={`tod-glow ${g.kind}`} style={at(g.x, g.y, g.r)} />
      ))}
      <div className="tod-moonlight" />
      {POOLS.map((p, i) => {
        const pw = p.x1 - p.x0;
        const ph = p.y1 - p.y0;
        return (
          <div key={`pool${i}`} className="pool-sky" style={box(p.x0, p.y0, pw, ph, WORLD_W, WORLD_H)}>
            {SUN_GLINTS[i].map((g, j) => (
              <span key={`s${j}`} className="glint sun" style={{ ...box(g.x, g.y, g.w, 1, pw, ph), animationDelay: `${g.d}s` }} />
            ))}
            {MOON_GLINTS[i].map((g, j) => (
              <span key={`m${j}`} className="glint moon" style={{ ...box(g.x, g.y, g.w + 1, 1, pw, ph), animationDelay: `${g.d}s` }} />
            ))}
          </div>
        );
      })}
      {FIREFLIES.map((f, i) => (
        <span key={`f${i}`} className="firefly" style={{ ...at(f.x, f.y, 0.6), animationDelay: `${f.d}s` }} />
      ))}
    </div>
  );
}
