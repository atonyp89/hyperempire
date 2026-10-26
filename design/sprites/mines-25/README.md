# 25 mines

Standalone mine entrances drawn for the Empire scene. **#11**, the brown earthy one, is the Mine below the Exchange.

| File | What |
| --- | --- |
| `sheet.png` | PixelLab Create Image Pro output: 5×5 candidates of 48×40 (240×200), with the scene as style |
| `cell/<n>.png` | Each candidate, sliced by the grid: n = row × 5 + column, from 0 at the top left. These touch across cells, so `candidates.py` can't separate them |
| `yard-cleared.png` | The 96×72 yard (world x 224–319, y 108–179) with the bush and crates painted out by PixelLab `inpaint_image` (55×44 mask at (29, 11)); the tree is kept |
| `on-lawn-3x.png` | Every candidate shown on the cleared yard where it would stand |

Prompt: "one mine entrance for a top-down RPG town, facing the viewer: a wide low grey rocky outcrop with a dark mine-shaft opening framed by a sturdy wooden timber frame, a short minecart rail track coming out to the front with a small wooden minecart of ore, a hanging lantern, chunky dark outline, few colors, the whole object fully visible and centered". Gallery: `gallery:f8c00f18-9a88-546d-b4df-ee00d321cb22`.

## How the Mine is placed

The world layers are rebuilt from `design/scene/backup-before-mine/`:

1. **Lawn:** the cleared lawn's changed pixels go in first. In `town-base.png` the swaying tree's box is skipped, since that tree is painted out of the base.
2. **Mine:** #11 is drawn on top, with its cell's top-left at world (257, 122).
3. **Hover outline:** `src/web/public/empire/mine.png` is #11 cropped to its pixels, so the outline matches the sprite exactly.

To try another design, rebuild the same way with another cell.
