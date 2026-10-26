// Wheat growing in the Garden's two plots: each plant goes seed → sprout → young → ripe, stays ripe a while,
// then is "harvested" back to seed. Plants start at different points of the cycle, so the field always shows
// a mix, spaced 11-12px apart so the plot's furrows show between plants. Sprites: public/empire/crops/wheat.png
// (4 stages of 16x16, made with PixelLab; see design/sprites/crops/README.md). Drawn under the time-of-day
// layers so night and morning reach them too.

import { useEffect, useState, type CSSProperties } from 'react';

const SCENE_W = 320;
const SCENE_H = 180;
const FRAME = 16;
/** The mound's bottom row inside the 16x16 frame. */
const SRC_FEET_Y = 14;

/** Stage shown at each step of the cycle: 0 seed, 1 sprout, 2 young, 3 ripe (ripe lasts two steps). */
const CYCLE = [0, 1, 2, 3, 3];
/** Seconds per step, so a plant takes CYCLE.length × STEP_S to come round. */
const STEP_S = 18;

/** Where each plant's mound sits (centre x, bottom y), in native scene pixels: on the raised soil of each plot. */
const PLANTS: { x: number; y: number }[] = [
  // Left plot: horizontal furrows, x 6-40, y 125-170.
  ...[142, 154, 166].flatMap((y) => [12, 23, 34].map((x) => ({ x, y }))),
  // Right plot: vertical furrows, x 42-70; the bush covers its bottom-right corner.
  ...[142, 154].flatMap((y) => [50, 62].map((x) => ({ x, y }))),
  { x: 50, y: 166 },
];

/** A fixed, varied start for each plant, so neighbours are rarely at the same stage. */
const offset = (i: number) => (i * 7 + (i % 3) * 2) % CYCLE.length;

export function Garden() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setStep((s) => s + 1), STEP_S * 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="garden" aria-hidden="true">
      {PLANTS.map((p, i) => {
        const stage = CYCLE[(step + offset(i)) % CYCLE.length];
        const style = {
          left: `${((p.x - FRAME / 2) / SCENE_W) * 100}%`,
          top: `${((p.y - SRC_FEET_Y) / SCENE_H) * 100}%`,
          width: `${(FRAME / SCENE_W) * 100}%`,
          height: `${(FRAME / SCENE_H) * 100}%`,
          backgroundPositionX: `${(stage / 3) * 100}%`,
          animationDelay: `${-(i % 5) * 0.7}s`,
        } as CSSProperties;
        return <span key={i} className={`crop stage-${stage}`} style={style} />;
      })}
    </div>
  );
}
