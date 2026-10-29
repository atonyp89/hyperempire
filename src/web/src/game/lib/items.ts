// What the game shows for each item id the API hands out: its name and icon. Crops show the ripe frame of their
// growth sheet; seeds ("wheat-seed") the first frame, the freshly sown mound.

import type { CSSProperties } from 'react';
import { CROPS, cropOfSeed, type CropId } from '@server/contract';

export type ItemInfo = { name: string; icon: CSSProperties };

const cropIcon = (id: CropId, frame: 'seed' | 'ripe'): CSSProperties => {
  const c = CROPS[id];
  return { backgroundImage: `url(${c.sprite})`, backgroundSize: `${c.stages * 100}% 100%`, backgroundPositionX: frame === 'seed' ? '0%' : '100%' };
};

export function itemInfo(id: string): ItemInfo {
  if (Object.hasOwn(CROPS, id)) return { name: CROPS[id as CropId].name, icon: cropIcon(id as CropId, 'ripe') };
  const seedOf = cropOfSeed(id);
  if (seedOf) return { name: `${CROPS[seedOf].name} seed`, icon: cropIcon(seedOf, 'seed') };
  return { name: id, icon: {} };
}
