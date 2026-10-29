// The player's hero on the Empire scene: knight #5 (public/empire/heroes/knight5/), moved with WASD or the
// arrow keys, and kept on the roads by public/empire/walkable.png (built by design/scene/walkable.py). The hero
// also drives the camera: the world is wider than the view, so it slides to keep the hero in sight. Roads that run
// behind a building (OCCLUDERS) hide the hero under its roof.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { VIEW_W, WORLD_H, WORLD_W } from './world';


/** Sheet rows, in the order of idle.png and walk.png (4 frames of 32x32 per row). */
export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
type Dir = (typeof DIRS)[number];

const FRAME = 32;
/** Drawn a little under 1:1 so the knight sits better next to the buildings. */
const SCALE = 0.8;
/** Where the feet sit inside a 32x32 frame. */
const SRC_FEET = { x: 16, y: 27 };
/** Starting spot: the plaza in front of the Townhall door. */
const START = { x: 156, y: 102 };
/** Walking speed in scene pixels per second. */
const SPEED = 42;
/** How far the feet may go: inside the scene, a little in from the edges. */
const BOUNDS = { x0: 8, x1: WORLD_W - 8, y0: 24, y1: WORLD_H - 2 };
/** How fast the camera catches up with the hero (per second); higher is snappier. */
const CAMERA_EASE = 5;
/** Feet half-width in scene pixels: every pixel of the feet must be on the road. */
const FOOT = 2;

/**
 * Buildings and trees the hero can walk behind: a road runs under their roof or canopy. While the feet are above
 * `front` (their ground line, in scene pixels), their cut-out masks the hero out, so they stay in front. The
 * canopies along the bottom edge have their trunks off the map, so the hero is always behind them.
 */
const OCCLUDERS = [
  { src: '/empire/market.png', x: 255, y: 101, w: 58, h: 60, front: 158 },
  { src: '/empire/trees/canopy1.png', x: 88, y: 168, w: 20, h: 12, front: WORLD_H + 1 },
  { src: '/empire/trees/canopy2.png', x: 113, y: 171, w: 15, h: 9, front: WORLD_H + 1 },
  { src: '/empire/trees/canopy3.png', x: 269, y: 169, w: 17, h: 11, front: WORLD_H + 1 },
];

/** Mask styles that cut the occluders out of a w x h box drawn at (left, top) in scene pixels, `unit` CSS px each. */
function occlude(left: number, top: number, w: number, h: number, footY: number, unit: number) {
  const hit = OCCLUDERS.filter(
    (o) => footY < o.front && left < o.x + o.w && o.x < left + w && top < o.y + o.h && o.y < top + h,
  );
  if (!hit.length) return { maskImage: '', maskSize: '', maskPosition: '', maskRepeat: '', maskComposite: '' };
  const px = (v: number) => `${v * unit}px`;
  return {
    maskImage: [...hit.map((o) => `url(${o.src})`), 'linear-gradient(#000 0 0)'].join(', '),
    maskSize: [...hit.map((o) => `${px(o.w)} ${px(o.h)}`), '100% 100%'].join(', '),
    maskPosition: [...hit.map((o) => `${px(o.x - left)} ${px(o.y - top)}`), '0 0'].join(', '),
    maskRepeat: 'no-repeat',
    maskComposite: 'exclude',
  };
}

/** Road mask, 1 per walkable scene pixel. Null until loaded (or if it fails, then nothing is blocked). */
let roads: Uint8Array | null = null;
const roadsReady = new Promise<void>((resolve) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = WORLD_W;
    c.height = WORLD_H;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, WORLD_W, WORLD_H).data;
      roads = new Uint8Array(WORLD_W * WORLD_H);
      for (let i = 0; i < roads.length; i++) roads[i] = px[i * 4 + 3] > 128 ? 1 : 0;
    }
    resolve();
  };
  img.onerror = () => resolve();
  img.src = '/empire/walkable.png';
});

/** True when the feet at (x, y) stand fully on the road. */
function onRoad(x: number, y: number) {
  if (!roads) return true;
  const fy = Math.round(y);
  for (let fx = Math.round(x) - FOOT; fx <= Math.round(x) + FOOT; fx++) {
    if (fx < 0 || fx >= WORLD_W || fy < 0 || fy >= WORLD_H || !roads[fy * WORLD_W + fx]) return false;
  }
  return true;
}

const KEYS: Record<string, [number, number]> = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

/** Facing for a movement vector (screen y grows downwards). */
function facing(dx: number, dy: number): Dir {
  const h = dx < 0 ? 'west' : dx > 0 ? 'east' : '';
  const v = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
  return (v && h ? `${v}-${h}` : v || h) as Dir;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Camera's left edge for a hero at x with a view `view` scene px wide: the hero centred, never past either end. */
const cameraFor = (x: number, view = VIEW_W) => clamp(x - view / 2, 0, Math.max(0, WORLD_W - view));
const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Box styles for the sprite and its shadow, from the feet position in scene pixels. */
function place(x: number, y: number) {
  const pct = (px: number, total: number) => `${(px / total) * 100}%`;
  return {
    sprite: { left: pct(x - SRC_FEET.x * SCALE, WORLD_W), top: pct(y - SRC_FEET.y * SCALE, WORLD_H) },
    shadow: { left: pct(x - 4, WORLD_W), top: pct(y - 1, WORLD_H) },
  };
}

export function Hero({ active }: { active: boolean }) {
  const [dir, setDir] = useState<Dir>('south');
  const [walking, setWalking] = useState(false);
  const pos = useRef({ ...START });
  /** Camera's left edge in scene pixels (see cameraFor). */
  const cam = useRef(cameraFor(START.x));
  const held = useRef(new Set<string>());
  const sprite = useRef<HTMLSpanElement>(null);
  const shadow = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!(k in KEYS) || editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      held.current.add(k);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase());
    const clear = () => held.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);

    let last = performance.now();
    let raf = 0;
    let stopped = false;
    let lastPx = NaN;
    let wasWalking = false;
    let lastDir: Dir = 'south';
    let lastMask = '';
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let dx = 0;
      let dy = 0;
      for (const k of held.current) {
        dx += KEYS[k][0];
        dy += KEYS[k][1];
      }
      dx = Math.sign(dx);
      dy = Math.sign(dy);
      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        const step = (SPEED * dt) / Math.hypot(dx, dy);
        const p = pos.current;
        const nx = clamp(p.x + dx * step, BOUNDS.x0, BOUNDS.x1);
        const ny = clamp(p.y + dy * step, BOUNDS.y0, BOUNDS.y1);
        // Take the whole step if it stays on the road, else slide along the edge on one axis.
        if (onRoad(nx, ny)) [p.x, p.y] = [nx, ny];
        else if (dx && onRoad(nx, p.y)) p.x = nx;
        else if (dy && onRoad(p.x, ny)) p.y = ny;
        // Snap to whole scene pixels so the sprite stays on the scene's pixel grid.
        const box = place(Math.round(p.x), Math.round(p.y));
        if (sprite.current) Object.assign(sprite.current.style, box.sprite);
        if (shadow.current) Object.assign(shadow.current.style, box.shadow);
        const d = facing(dx, dy);
        if (d !== lastDir) setDir((lastDir = d));
      }
      // Hide what stands behind a building or tree (each frame, since a resize changes the mask's pixel size).
      const s = sprite.current;
      const sh = shadow.current;
      if (s && sh) {
        const [x, y] = [Math.round(pos.current.x), Math.round(pos.current.y)];
        const unit = s.offsetWidth / (FRAME * SCALE);
        const key = `${x},${y},${unit}`;
        if (key !== lastMask) {
          lastMask = key;
          const size = FRAME * SCALE;
          Object.assign(s.style, occlude(x - SRC_FEET.x * SCALE, y - SRC_FEET.y * SCALE, size, size, y, unit));
          Object.assign(sh.style, occlude(x - 4, y - 1, 8, 2, y, unit));
        }
      }
      if (moving !== wasWalking) setWalking((wasWalking = moving));
      // Ease the camera toward the hero and slide the world under the view, in whole screen pixels so the
      // pixel art doesn't shimmer.
      const world = sprite.current?.closest<HTMLElement>('.world');
      if (world) {
        // How much of the world the scene box shows, in scene pixels: 320 on a 16:9 screen, up to 480.
        const view = ((world.parentElement?.clientWidth ?? 0) / world.offsetWidth) * WORLD_W || VIEW_W;
        const target = cameraFor(pos.current.x, view);
        cam.current += (target - cam.current) * Math.min(1, dt * CAMERA_EASE);
        if (Math.abs(target - cam.current) < 0.05) cam.current = target;
        const px = Math.round((cam.current / WORLD_W) * world.offsetWidth);
        if (px !== lastPx) world.style.transform = `translateX(${-(lastPx = px)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    roadsReady.then(() => {
      if (stopped) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      held.current.clear();
      setWalking(false);
    };
  }, [active]);

  const box = place(Math.round(pos.current.x), Math.round(pos.current.y));
  const size = { width: `${((FRAME * SCALE) / WORLD_W) * 100}%`, height: `${((FRAME * SCALE) / WORLD_H) * 100}%` };
  const row = { '--row': DIRS.indexOf(dir) } as CSSProperties;
  return (
    <>
      <img
        ref={shadow}
        className="hero-shadow"
        src="/empire/heroes/shadow.png"
        alt=""
        aria-hidden="true"
        style={{ ...box.shadow, width: `${(8 / WORLD_W) * 100}%`, height: `${(2 / WORLD_H) * 100}%` }}
      />
      <span ref={sprite} className={`hero-sprite ${walking ? 'walking' : ''}`} aria-hidden="true" style={{ ...box.sprite, ...size, ...row }} />
    </>
  );
}
