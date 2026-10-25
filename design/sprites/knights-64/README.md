# 64 knights

A library of front-facing knight poses drawn for the Empire scene, for future heroes, NPCs and guards. Knight #5 is the current hero (`src/web/public/empire/heroes/knight5/`).

| File | What |
| --- | --- |
| `sheet.png` | The PixelLab output as delivered: 8×8 candidates on a 24px grid (192×192). Sprites spill over their cell edges, so don't slice it by cells |
| `cut/<n>.png` | Each candidate cut out by its own pixels (`../candidates.py`), cropped tight, about 15–20×22–26px |
| `contact-5x.png` | All 64 on scene grass at 5×. Number n = row × 8 + column, counting from 0 at the top left |
| `in-scene-6x.png` | #7, #13, #15, #38, #53 and #57 pasted on the plaza at 1:1, shown at 6× |

## How they were made

- **Tool:** PixelLab Create Image Pro, 24×24 canvas, transparent background, 64 candidates for 10 generations.
- **Style image:** the scene, `design/scene/townhall-pixellab-1x.png`.
- **Prompt:** "one tiny knight hero sprite for this top-down town, about 18 pixels tall, full body with both feet visible, standing still facing the viewer, steel helmet with a small red plume, steel armor, red tabard with a gold emblem, short red cape, sword at his side, round shield, simple chunky dark outline, few colors, centered with a 2 pixel margin on every side".
- **PixelLab gallery:** `gallery:f41e2fc6-aab6-53e6-bd10-ad863c631dbf` (job `dfe062af-371a-4fca-8e29-971dcf73ee17`).

## Turning one into a character

The full process, walk and scene included, is in [design/characters.md](../../characters.md). In short, for #5:

1. **Pad:** put `cut/<n>.png` on a 32×32 transparent canvas, feet about 4px from the bottom. PixelLab's v3 turnaround needs at least 32px.
2. **Turn:** upload it and call `create_character` with mode v3 and `reference_image_url` set to the upload. That gives 8 directions for 1 generation.
3. **Idle:** build it by hand. PixelLab's breathing-idle template redraws the body and can drop details such as the sword. For #5, everything above the legs dips 1px on two of four frames.
4. **Walk:** generate it with PixelLab's walking-4-frames in skeleton-v3 mode, 3 generations a direction.
5. **Pack:** build the idle and walk sheets with `../pack_hero.py`, and draw them at 0.8× in the scene.
