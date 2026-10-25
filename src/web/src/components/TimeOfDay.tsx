// Time-of-day layers over the Empire scene: a morning grade with sunbeams and motes, a night tint with lit windows,
// lamp and doorway glows, and fireflies. All layers stay mounted and fade with opacity, so
// switching phase is a smooth transition.

import type { CSSProperties } from 'react';
import type { Phase } from '../hooks/useDayPhase';

const SCENE_W = 320;
const SCENE_H = 180;
const at = (x: number, y: number, r: number): CSSProperties => ({
  left: `${((x - r) / SCENE_W) * 100}%`,
  top: `${((y - r) / SCENE_H) * 100}%`,
  width: `${((2 * r) / SCENE_W) * 100}%`,
  height: `${((2 * r) / SCENE_H) * 100}%`,
});

/** Warm light pools at night: [x, y, radius] in native scene pixels. */
const GLOWS: { x: number; y: number; r: number; kind: 'lamp' | 'door' | 'window' }[] = [
  { x: 95.5, y: 70, r: 16, kind: 'lamp' },
  { x: 292.5, y: 108, r: 16, kind: 'lamp' },
  { x: 137, y: 176, r: 15, kind: 'lamp' },
  { x: 156, y: 80, r: 20, kind: 'door' },
  { x: 278, y: 76, r: 16, kind: 'door' },
  { x: 30, y: 72, r: 12, kind: 'window' },
  { x: 57, y: 72, r: 9, kind: 'window' },
  { x: 156, y: 57, r: 7, kind: 'window' },
];

/** Dust motes drifting through the morning sunbeams. */
const MOTES = [
  { x: 30, y: 18, d: 0 },
  { x: 70, y: 8, d: -2.2 },
  { x: 118, y: 26, d: -4.5 },
  { x: 48, y: 50, d: -6.1 },
  { x: 150, y: 12, d: -3.3 },
  { x: 92, y: 40, d: -7.4 },
];

const FIREFLIES = [
  { x: 100, y: 50, d: 0 },
  { x: 86, y: 58, d: -1.4 },
  { x: 250, y: 128, d: -0.6 },
  { x: 262, y: 92, d: -2.1 },
  { x: 40, y: 140, d: -1.1 },
  { x: 70, y: 160, d: -2.6 },
  { x: 310, y: 130, d: -0.3 },
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
      {FIREFLIES.map((f, i) => (
        <span key={`f${i}`} className="firefly" style={{ ...at(f.x, f.y, 0.6), animationDelay: `${f.d}s` }} />
      ))}
    </div>
  );
}
