// What the game shows for each item id the API hands out: its name and icon. Crops and their seeds each have an
// inventory icon of their own (public/empire/items/).

import type { CSSProperties } from 'react';
import { CROPS, cropOfSeed, type CropId } from '@server/contract';

export type ItemInfo = { name: string; icon: CSSProperties };

const image = (src: string): CSSProperties => ({ backgroundImage: `url(${src})`, backgroundSize: '100% 100%' });

export function itemInfo(id: string): ItemInfo {
  if (Object.hasOwn(CROPS, id)) return { name: CROPS[id as CropId].name, icon: image(CROPS[id as CropId].icon) };
  const seedOf = cropOfSeed(id);
  if (seedOf) return { name: CROPS[seedOf].seedName, icon: image(CROPS[seedOf].seedIcon) };
  return { name: id, icon: {} };
}
