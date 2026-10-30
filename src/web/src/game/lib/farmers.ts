// How Farmers look: the Farmer character (public/empire/farmers/farmer/, made with PixelLab; see
// docs/graphics/characters.md), a readable line for a Farmer's grade and perks, and its hunger and happiness
// ticking down.

import type { CSSProperties } from 'react';
import { CHEER_MS, HAPPINESS_FULL, HUNGER_FULL, MEAL_MS, MOOD_PERKS, moodOf, type FarmerView } from '@server/contract';

/** Sheets of 4 frames x 8 directions of 32x32 (rows in the knight's DIRS order), standing and walking. */
export const FARMER_SHEETS = { idle: '/empire/farmers/farmer/idle.png', walk: '/empire/farmers/farmer/walk.png' } as const;

/** The Farmer standing, facing the viewer: the first frame of the idle sheet's south row. */
export const farmerPortrait: CSSProperties = {
  backgroundImage: `url(${FARMER_SHEETS.idle})`,
  backgroundSize: '400% 800%',
  backgroundPosition: '0 0',
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const farmerName = (f: FarmerView) => `${cap(f.grade)} Farmer`;
/** "+5% yield · −4% growth"; with a `scale` (its mood), the perks it gives now ("+2.5%…"). */
export const farmerPerks = (f: { yieldPct: number; growthPct: number }, scale = 1) => `+${f.yieldPct * scale}% yield · −${f.growthPct * scale}% growth`;

/** Hunger at `now` (server time): a working Farmer counts down to its `diesAt`; a resting one stays put. */
export const hungerNow = (f: FarmerView, now: number, speed: number) =>
  f.diesAt == null ? f.hunger : Math.max(0, Math.min(HUNGER_FULL, ((f.diesAt - now) / (MEAL_MS / speed)) * HUNGER_FULL));

/** Below this a Farmer looks hungry: under a day of food left. */
export const HUNGRY_AT = HUNGER_FULL / 3;

/** Happiness at `now`: a working Farmer's drains from the view's time `at`; a resting or dead one stays put. */
export const happinessNow = (f: FarmerView, at: number, now: number, speed: number) =>
  f.diesAt == null ? f.happiness : Math.max(0, f.happiness - ((now - at) * speed * HAPPINESS_FULL) / CHEER_MS);

/** How much of its perks a Farmer gives at this happiness: 0 when dead. */
export const perkScaleOf = (dead: boolean, happiness: number) => (dead ? 0 : MOOD_PERKS[moodOf(happiness)]);
