// What the game shows for each item id the API hands out: its name, icon and kind, and a seed's grade. Crops,
// seeds and seed packs each have an inventory icon of their own (public/empire/items/); a seed's grade colours
// its slot.

import type { CSSProperties } from 'react';
import { CROPS, cropOfPack, parseSeed, type CropId, type Grade } from '@server/contract';

export type ItemKind = 'pack' | 'seed' | 'crop' | 'other';
export type ItemInfo = { name: string; icon: CSSProperties; kind: ItemKind; crop?: CropId; grade?: Grade };

const image = (src: string): CSSProperties => ({ backgroundImage: `url(${src})`, backgroundSize: '100% 100%' });
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function itemInfo(id: string): ItemInfo {
  if (Object.hasOwn(CROPS, id)) {
    const c = CROPS[id as CropId];
    return { name: c.name, icon: image(c.icon), kind: 'crop', crop: c.id };
  }
  const packOf = cropOfPack(id);
  if (packOf) return { name: CROPS[packOf].packName, icon: image(CROPS[packOf].packIcon), kind: 'pack', crop: packOf };
  const seed = parseSeed(id);
  if (seed) {
    const c = CROPS[seed.crop];
    return { name: `${cap(seed.grade)} ${c.seedName.toLowerCase()}`, icon: image(c.seedIcon), kind: 'seed', crop: c.id, grade: seed.grade };
  }
  return { name: id, icon: {}, kind: 'other' };
}
