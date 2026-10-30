// The Garden's working Farmers, wandering its road: each picks a nearby spot on the road, walks there, stands a
// moment and picks another. They walk with the same road mask, facing and sheets layout as the knight (Hero.tsx),
// and are drawn just under him. Positions update straight on the DOM each frame, without re-rendering.

import { useEffect, useRef, type CSSProperties } from 'react';
import type { FarmerView } from '@server/contract';
import { FARMER_SHEETS } from '../lib/farmers';
import { DIRS, facing, loadRoads, onRoad, type HeroScene, type Roads } from './Hero';

const FRAME = 32;
/** Drawn at the knight's size. */
const SCALE = 0.8;
const SRC_FEET = { x: 16, y: 27 };
/** Slower than the knight: Farmers stroll. */
const SPEED = 16;
/** How far a Farmer looks for its next spot, in scene pixels. */
const WANDER = 40;
const REST_MS: [number, number] = [1_200, 4_000];
/** Highest a Farmer's feet go, so its hat stays inside the scene (the knight stops at 24). */
const TOP = 26;

type Walker = { x: number; y: number; tx: number; ty: number; restUntil: number; dir: number; walking: boolean };

/** A random road pixel within WANDER of (x, y), or null if a few tries find none. */
function nearbyRoad(roads: Roads, x: number, y: number): [number, number] | null {
  for (let i = 0; i < 20; i++) {
    const tx = Math.round(x + (Math.random() * 2 - 1) * WANDER);
    const ty = Math.round(y + (Math.random() * 2 - 1) * WANDER);
    if (ty >= TOP && onRoad(roads, tx, ty)) return [tx, ty];
  }
  return null;
}

/** A random road pixel anywhere, for a Farmer's starting spot. */
function anyRoad(roads: Roads, scene: HeroScene): [number, number] {
  for (let i = 0; i < 500; i++) {
    const x = 8 + Math.floor(Math.random() * (scene.w - 16));
    const y = TOP + Math.floor(Math.random() * (scene.h - TOP - 2));
    if (onRoad(roads, x, y)) return [x, y];
  }
  return [scene.start.x, scene.start.y];
}

export function FarmerWalkers({ farmers, scene }: { farmers: FarmerView[]; scene: HeroScene }) {
  const els = useRef(new Map<number, HTMLSpanElement>());
  const walkers = useRef(new Map<number, Walker>());

  useEffect(() => {
    let raf = 0;
    let stopped = false;
    let last = performance.now();
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    void loadRoads(scene).then((roads) => {
      if (stopped) return;
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        for (const f of farmers) {
          let w = walkers.current.get(f.id);
          if (!w) {
            const [x, y] = anyRoad(roads, scene);
            w = { x, y, tx: x, ty: y, restUntil: now + Math.random() * 2_000, dir: 0, walking: false };
            walkers.current.set(f.id, w);
          }
          const dx = w.tx - w.x;
          const dy = w.ty - w.y;
          const dist = Math.hypot(dx, dy);
          let walking = false;
          if (now >= w.restUntil) {
            if (dist < 1) {
              // Arrived: rest, then head for a new spot nearby.
              const next = nearbyRoad(roads, w.x, w.y);
              if (next) [w.tx, w.ty] = next;
              w.restUntil = now + REST_MS[0] + Math.random() * (REST_MS[1] - REST_MS[0]);
            } else {
              const step = Math.min(dist, SPEED * dt);
              const nx = w.x + (dx / dist) * step;
              const ny = w.y + (dy / dist) * step;
              if (onRoad(roads, nx, ny)) [w.x, w.y] = [nx, ny];
              else if (onRoad(roads, nx, w.y)) w.x = nx;
              else if (onRoad(roads, w.x, ny)) w.y = ny;
              else [w.tx, w.ty] = [w.x, w.y]; // blocked: give up on that spot
              walking = true;
              w.dir = DIRS.indexOf(facing(Math.abs(dx) > 0.5 ? Math.sign(dx) : 0, Math.abs(dy) > 0.5 ? Math.sign(dy) : 0) ?? 'south');
            }
          }
          w.walking = walking;
          const el = els.current.get(f.id);
          if (el) {
            el.style.left = pct(Math.round(w.x) - SRC_FEET.x * SCALE, scene.w);
            el.style.top = pct(Math.round(w.y) - SRC_FEET.y * SCALE, scene.h);
            el.style.setProperty('--row', String(Math.max(0, w.dir)));
            el.classList.toggle('walking', walking);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [farmers, scene]);

  const size: CSSProperties = { width: `${((FRAME * SCALE) / scene.w) * 100}%`, height: `${((FRAME * SCALE) / scene.h) * 100}%` };
  return (
    <>
      {farmers.map((f) => (
        <span
          key={f.id}
          ref={(el) => {
            if (el) els.current.set(f.id, el);
            else els.current.delete(f.id);
          }}
          className={`farmer-walker grade-${f.grade}`}
          aria-hidden="true"
          style={{ ...size, left: '-100%', '--idle': `url(${FARMER_SHEETS.idle})`, '--walk': `url(${FARMER_SHEETS.walk})` } as CSSProperties}
        />
      ))}
    </>
  );
}
