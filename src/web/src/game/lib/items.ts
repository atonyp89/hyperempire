// What the game shows for each item id the API hands out: its name and icon. Crops so far; their icon is the
// ripe frame of the crop's growth sheet.

import type { CSSProperties } from 'react';
import { CROPS, type CropId } from '@server/contract';

export type ItemInfo = { name: string; icon: CSSProperties };

const cropIcon = (id: CropId): CSSProperties => {
  const c = CROPS[id];
  return { backgroundImage: `url(${c.sprite})`, backgroundSize: `${c.stages * 100}% 100%`, backgroundPositionX: '100%' };
};

export function itemInfo(id: string): ItemInfo {
  if (Object.hasOwn(CROPS, id)) return { name: CROPS[id as CropId].name, icon: cropIcon(id as CropId) };
  return { name: id, icon: {} };
}
