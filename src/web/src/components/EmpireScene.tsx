// The empire's main scene. Buildings are hotspots over the town image; the Exchange opens trading.

import { Ambient } from './Ambient';
import { TimeOfDay } from './TimeOfDay';
import type { Phase } from '../hooks/useDayPhase';

export type BuildingId = 'townhall' | 'tavern' | 'exchange' | 'garden';

type Building = {
  id: BuildingId;
  name: string;
  detail: string;
  /** Hotspot box as percentages of the 320x180 scene. */
  box: { left: number; top: number; width: number; height: number };
  ready: boolean;
  /** Cut-out of the building (made by design/scene/cutout.py), drawn over the scene to highlight its shape on hover. */
  sprite?: string;
};

const SCENE_W = 320;
const SCENE_H = 180;
/** Hotspot box from a cut-out's native-pixel crop, so the sprite lines up with the scene exactly. */
const fromCrop = (x: number, y: number, w: number, h: number) => ({
  left: (x / SCENE_W) * 100,
  top: (y / SCENE_H) * 100,
  width: (w / SCENE_W) * 100,
  height: (h / SCENE_H) * 100,
});

/**
 * The player's hero standing on the plaza in front of the Townhall door: knight #5's idle
 * (public/empire/heroes/knight5/idle-south.png: the PixelLab sprite, then its head, torso and sword 1px lower;
 * 4 frames of 32x32, about 22px tall) at 1:1 with the
 * scene's pixels, over a 10x3 pixel shadow (public/empire/heroes/shadow.png).
 */
const HERO = { feetX: 156, feetY: 102, frame: 32, scale: 1, srcFeetX: 16, srcFeetY: 27 };
const HERO_BOX = fromCrop(
  HERO.feetX - HERO.srcFeetX * HERO.scale,
  HERO.feetY - HERO.srcFeetY * HERO.scale,
  HERO.frame * HERO.scale,
  HERO.frame * HERO.scale,
);
const SHADOW_BOX = fromCrop(HERO.feetX - 5, HERO.feetY - 1, 10, 3);
const pct = (b: { left: number; top: number; width: number; height: number }) => ({
  left: `${b.left}%`,
  top: `${b.top}%`,
  width: `${b.width}%`,
  height: `${b.height}%`,
});

const BUILDINGS: Building[] = [
  { id: 'townhall', name: 'TOWNHALL', detail: 'LEVEL UP · PERKS', box: fromCrop(106, 9, 100, 73), ready: true, sprite: '/empire/townhall.png' },
  { id: 'tavern', name: 'TAVERN', detail: 'RECRUIT HEROES · PHASE 2', box: fromCrop(1, 18, 71, 66), ready: false, sprite: '/empire/tavern.png' },
  { id: 'exchange', name: 'EXCHANGE', detail: 'TRADE PERPS · EARN $AURA', box: fromCrop(248, 11, 60, 70), ready: true, sprite: '/empire/exchange.png' },
  { id: 'garden', name: 'GARDEN', detail: 'GROW SEEDS · PHASE 3', box: { left: 0, top: 63, width: 24, height: 37 }, ready: false },
];

export function EmpireScene({ onOpen, phase }: { onOpen: (id: BuildingId) => void; phase: Phase }) {
  return (
    <div className="scene-wrap">
      <div className={`scene phase-${phase}`}>
        <img
          className="scene-img"
          src="/empire/town-base.png"
          alt="Your empire: the Townhall at the center behind a plaza with statue pools, the Tavern on the left, the Exchange on the right and the Garden fields at the bottom left"
        />
        <Ambient />
        <TimeOfDay phase={phase} />
        {BUILDINGS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hotspot ${b.ready ? 'ready' : 'locked'} ${b.sprite ? 'has-sprite' : ''}`}
            style={{ left: `${b.box.left}%`, top: `${b.box.top}%`, width: `${b.box.width}%`, height: `${b.box.height}%` }}
            onClick={b.ready ? () => onOpen(b.id) : undefined}
            aria-disabled={!b.ready}
            aria-label={`${b.name}: ${b.detail}${b.ready ? '' : ' (not available yet)'}`}
          >
            {b.sprite && <img className="hl-sprite" src={b.sprite} alt="" aria-hidden="true" />}
            <span className="plate">
              <span className="plate-name">{b.name}</span>
              <span className="plate-detail">{b.detail}</span>
            </span>
          </button>
        ))}
        <Hero />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <>
      <img className="hero-shadow" src="/empire/heroes/shadow.png" alt="" aria-hidden="true" style={pct(SHADOW_BOX)} />
      <span className="hero-sprite" aria-hidden="true" style={pct(HERO_BOX)} />
    </>
  );
}
