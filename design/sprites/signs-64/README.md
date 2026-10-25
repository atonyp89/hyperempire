# 64 signboards

Blank wooden signboards drawn for the Empire scene. An earlier, larger set (about 34×21), too big next to the trees and fences. Not used in the scene; kept for bigger signs later, such as a notice board.

| File | What |
| --- | --- |
| `sheet.png` | PixelLab output as delivered: 8×8 candidates on a 40×24 grid (320×192) |
| `cut/<n>.png` | Each one cut out by its own pixels (`python3 ../candidates.py sheet.png 40x24 cut`) |
| `contact.png`, `contact-4x.png` | All 64 on grass; n = row × 8 + column, from 0 at the top left |

## How they were made

- **Tool:** PixelLab Create Image Pro, 40×24 canvas, transparent background, 64 candidates for 10 generations.
- **Style image:** the scene, `design/scene/townhall-pixellab-1x.png`.
- **Prompt:** "one small blank wooden signboard standing on two short wooden posts, a wide flat plank face with NO text and no symbols, simple wood grain, for a top-down RPG town, front view, chunky dark outline, few colors, centered with a 1 pixel margin".
- **PixelLab gallery:** `gallery:aced5205-0c8b-5ae0-a8de-244452383ed5`.

The tones run in columns: warm, dark, weathered grey, pale grey, sand, red, brown, grey-brown. Rows vary the shape, with plain planks, two planks and worn posts. This gives a matching sign for any future building.
