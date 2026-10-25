# 64 small signboards

Town-size blank signboards, about 21×14 scene pixels each. They were tried as building signs, with #1 (21×15, plank rows 2–7) carrying the name, then the scene went back to the pixel-font name plates. Kept for later, such as wayfinding signs or quest boards.

| File | What |
| --- | --- |
| `sheet.png` | PixelLab output: 8×8 candidates on a 24×16 grid (192×128) |
| `cut/<n>.png` | Each one cut out by its own pixels (`python3 ../candidates.py sheet.png 24x16 cut`) |
| `contact.png`, `contact-5x.png` | All 64 on grass; n = row × 8 + column, from 0 at the top left |

## How they were made

- **Tool:** PixelLab Create Image Pro, 24×16 canvas, transparent background, 64 candidates for 10 generations.
- **Style image:** the scene, `design/scene/townhall-pixellab-1x.png`.
- **Prompt:** "one tiny blank wooden signboard on two short wooden posts, about 22 pixels wide and 13 pixels tall, a wide flat plank face with NO text and no symbols, for a top-down RPG town, front view, chunky dark outline, few colors, centered".
- **PixelLab gallery:** `gallery:b23324de-7054-5c5e-afe3-a0b5eef9e001`.
