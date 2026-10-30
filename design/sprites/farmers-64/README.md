# 64 farmers

Farmer villagers drawn for the Empire scene, the same size and style as the knights (`../knights-64/`). **#9**, straw hat, white shirt, overalls and a hoe, is the Farmer (`src/web/public/empire/farmers/farmer/`).

| File | What |
| --- | --- |
| `raw/<n>.png` | PixelLab Create Image Pro output, 64 candidates of 24×24, with the scene (`../../scene/townhall-pixellab-1x.png`) as style |
| `sheet.png` | The 64 tiles stitched back into the 192×192 sheet |
| `cut/<n>.png` | Each candidate cut out by `../candidates.py` (n = row × 8 + column) |

Prompt: "one tiny farmer villager sprite for this top-down town, about 18 pixels tall, full body with both feet visible, standing still facing the viewer, wide straw hat, short brown hair, simple cream shirt, blue denim overalls, brown boots, a small hoe or watering can held at his side, simple chunky dark outline, few colors, centered with a 2 pixel margin on every side". Gallery asset `0ecedd89-5053-569d-a897-b734e20e91c8`.

## How the Farmer was made

Exactly the knight's steps in `docs/graphics/characters.md`:

1. #9 padded to 32×32, feet 4px from the bottom: `farmer/concept-9.png`.
2. `create_character` v3 from it, 8 directions, low top-down (1 generation): `farmer/rotations/`.
3. `animate_character` `walking-4-frames` in **skeleton-v3** mode, south first to check, then the other 7 (24 generations): `farmer/walk/<dir>/`.
4. `python3 pack_hero.py ../../src/web/public/empire/farmers/farmer` packs `idle.png` and `walk.png` (4 frames × 8 directions of 32×32, the knight's layout).

PixelLab character: `88e4fa37-5e89-4d41-bb18-13e0368dbde5`.

In the game every Farmer uses this sprite; its grade shows as an outline in the grade's colour (the Garden scene, the Tavern and the Garden's Farmer slots).
