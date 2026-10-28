// The empire's main scene: a view onto a world wider than the screen (world.ts). Buildings are hotspots over
// the town image; the Exchange opens trading.
// Each building's plate shows its name; hovering or focusing the building adds what it does.

import { Ambient } from './Ambient';
import { Garden } from './Garden';
import { TimeOfDay } from './TimeOfDay';
import { Hero } from './Hero';
import type { Phase } from '../hooks/useDayPhase';
import { WORLD_H, WORLD_W } from './world';

export type BuildingId = 'townhall' | 'tavern' | 'exchange' | 'garden' | 'workshop' | 'mine';

type Building = {
  id: BuildingId;
  name: string;
  /** Short tag, shown with `about` on hover. */
  detail: string;
  /** What the building does, shown on hover. */
  about: string;
  /** Hotspot box as percentages of the 480x180 world. */
  box: { left: number; top: number; width: number; height: number };
  ready: boolean;
  /** Where the name plate's centre sits, in native scene pixels; the middle of the box when left out. */
  plate?: { x: number; y: number };
  /** Cut-out of the building (made by design/scene/cutout.py), drawn over the scene to highlight its shape on hover. */
  sprite?: string;
};

/** Hotspot box from a cut-out's native-pixel crop, so the sprite lines up with the scene exactly. */
const fromCrop = (x: number, y: number, w: number, h: number) => ({
  left: (x / WORLD_W) * 100,
  top: (y / WORLD_H) * 100,
  width: (w / WORLD_W) * 100,
  height: (h / WORLD_H) * 100,
});

/** Plate position inside its hotspot box, in % of the box: from `plate` (scene pixels), else the middle. */
const plateAt = (b: Building) =>
  b.plate
    ? {
        left: `${(((b.plate.x / WORLD_W) * 100 - b.box.left) / b.box.width) * 100}%`,
        top: `${(((b.plate.y / WORLD_H) * 100 - b.box.top) / b.box.height) * 100}%`,
      }
    : undefined;

const BUILDINGS: Building[] = [
  { id: 'townhall', name: 'TOWNHALL', detail: 'LEVEL UP · PERKS', about: "Your empire's heart. Spend $aura to level up, then put perk points into Trader, Fighter and Crafter.", box: fromCrop(106, 9, 100, 73), ready: true, sprite: '/empire/townhall.png' },
  { id: 'tavern', name: 'TAVERN', detail: 'RECRUIT HEROES', about: 'Recruit heroes and send them on adventures. Coming soon…', box: fromCrop(1, 18, 71, 66), plate: { x: 44, y: 48 }, ready: false, sprite: '/empire/tavern.png' },
  { id: 'exchange', name: 'EXCHANGE', detail: 'TRADE PERPS · EARN $AURA', about: 'Trade Hyperliquid perps. Every $1 of builder fee you pay earns 500 $aura.', box: fromCrop(248, 11, 60, 70), plate: { x: 278, y: 39 }, ready: true, sprite: '/empire/exchange.png' },
  { id: 'garden', name: 'GARDEN', detail: 'GROW SEEDS', about: 'Grow seeds into crafting materials. Coming soon…', box: fromCrop(0, 113, 77, 67), ready: false },
  { id: 'workshop', name: 'WORKSHOP', detail: 'CRAFT GEAR', about: 'Craft gear from garden materials and salvage. Coming soon…', box: fromCrop(383, 10, 63, 73), ready: false, sprite: '/empire/workshop.png' },
  { id: 'mine', name: 'MINE', detail: 'SEND MINERS', about: 'Send your miners to dig for resources: BTC, ETH, oil and more. Coming soon…', box: fromCrop(426, 134, 48, 37), plate: { x: 450, y: 139 }, ready: false, sprite: '/empire/mine.png' },
];

/** `heroActive`: WASD moves the hero (off while a building screen is open). */
export function EmpireScene({ onOpen, phase, heroActive }: { onOpen: (id: BuildingId) => void; phase: Phase; heroActive: boolean }) {
  return (
    <div className="scene-wrap">
      <div className={`scene phase-${phase}`}>
        {/* The world is wider than the view; Hero.tsx slides it to follow the hero. */}
        <div className="world">
          <img
            className="scene-img"
            src="/empire/town-base.png"
            alt="Your empire: the Townhall at the center behind a plaza with statue pools, the Tavern on the left, the Exchange on the right, the Garden fields at the bottom left, the Workshop to the east and the Mine below it"
          />
          <Garden />
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
              <span className="plate" style={plateAt(b)}>
                <span className="plate-name">{b.name}</span>
                <span className="plate-more">
                  <span className="plate-detail">{b.detail}</span>
                  <span className="plate-about">{b.about}</span>
                </span>
              </span>
            </button>
          ))}
          <Hero active={heroActive} />
        </div>
      </div>
    </div>
  );
}
