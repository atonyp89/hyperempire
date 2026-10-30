// How Farmers look: the Farmer character (public/empire/farmers/farmer/, made with PixelLab; see
// docs/graphics/characters.md) and a readable line for a Farmer's grade and perks.

import type { CSSProperties } from 'react';
import type { FarmerView } from '@server/contract';

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
export const farmerPerks = (f: { yieldPct: number; growthPct: number }) => `+${f.yieldPct}% yield · −${f.growthPct}% growth`;
