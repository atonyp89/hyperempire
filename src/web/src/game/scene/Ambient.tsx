// Ambient life over the Empire scene: drifting wind streaks, gusts that carry leaves, and trees that sway.
// Trees are cut-outs (design/scene/cutout.py --tree) painted out of the base image (remove_sprites.py),
// so they can move without a ghost underneath. Everything stops for players who prefer reduced motion.

import { useEffect, useState, type CSSProperties } from 'react';
import { WORLD_H, WORLD_W } from './world';

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

const TREES = [
  { src: '/empire/trees/tree1.png', x: 88, y: 40, w: 19, h: 23, dur: 3.4, delay: 0 },
  { src: '/empire/trees/tree2.png', x: 253, y: 79, w: 18, h: 22, dur: 3.9, delay: -1.3 },
];

/** Fixed wind streaks: row (native px), length (native px), loop duration and offset (s). */
const STREAKS = [
  { y: 22, len: 18, dur: 9, delay: 0 },
  { y: 58, len: 12, dur: 11, delay: -4 },
  { y: 96, len: 22, dur: 8, delay: -2 },
  { y: 128, len: 14, dur: 12, delay: -7 },
  { y: 152, len: 16, dur: 10, delay: -5 },
];

const LEAF_COLORS = ['#8fbf6a', '#6a8954', '#e5af5f', '#a6936d', '#c27a4a'];

type Leaf = { id: number; y: number; dur: number; delay: number; drift: number; color: string; size: number };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** A gust every 7–13 s: trees bend harder for a moment and a handful of leaves blow across. */
function useGusts(enabled: boolean) {
  const [gust, setGust] = useState(false);
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let next = 0;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => alive && fn(), ms));

    const blow = () => {
      setGust(true);
      const count = 6 + Math.floor(Math.random() * 5);
      const band = 20 + Math.random() * 110;
      const fresh: Leaf[] = Array.from({ length: count }, () => ({
        id: ++next,
        y: band + Math.random() * 50,
        dur: 3.2 + Math.random() * 1.8,
        delay: Math.random() * 0.9,
        drift: (Math.random() - 0.5) * 30,
        color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
        size: Math.random() < 0.3 ? 3 : 2,
      }));
      setLeaves((l) => [...l, ...fresh]);
      later(() => setGust(false), 2600);
      later(() => setLeaves((l) => l.filter((x) => !fresh.includes(x))), 6000);
      later(blow, 7000 + Math.random() * 6000);
    };
    later(blow, 2500);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [enabled]);
  return { gust, leaves };
}

export function Ambient() {
  const reduced = usePrefersReducedMotion();
  const { gust, leaves } = useGusts(!reduced);

  return (
    <div className={`ambient ${gust ? 'gust' : ''} ${reduced ? 'still' : ''}`} aria-hidden="true">
      {TREES.map((t) => (
        <img
          key={t.src}
          className="tree-sprite"
          src={t.src}
          alt=""
          style={
            {
              left: pct(t.x, WORLD_W),
              top: pct(t.y, WORLD_H),
              width: pct(t.w, WORLD_W),
              height: pct(t.h, WORLD_H),
              '--dur': `${t.dur}s`,
              '--delay': `${t.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      {!reduced &&
        STREAKS.map((s, i) => (
          <span
            key={i}
            className="wind"
            style={
              {
                top: pct(s.y, WORLD_H),
                width: pct(s.len, WORLD_W),
                // translate % is relative to the streak itself: cross ~124% of the scene
                '--cross': `${(124 * WORLD_W) / s.len}%`,
                '--dur': `${s.dur}s`,
                '--delay': `${s.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      {leaves.map((l) => (
        <span
          key={l.id}
          className="leaf"
          style={
            {
              top: pct(l.y, WORLD_H),
              width: pct(l.size, WORLD_W),
              height: pct(l.size, WORLD_H),
              '--dur': `${l.dur}s`,
              '--delay': `${l.delay}s`,
              // translate % is relative to the leaf: cross ~105% of the scene, bob ~10 native px
              '--cross': `${(105 * WORLD_W) / l.size}%`,
              '--bob': `${(10 / l.size) * 100}%`,
              '--drift': `${(l.drift / l.size) * 100}%`,
              background: l.color,
            } as CSSProperties
          }
        >
          <span className="leaf-shade" />
        </span>
      ))}
    </div>
  );
}
