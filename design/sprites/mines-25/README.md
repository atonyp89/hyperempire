# 25 mines

Standalone mine entrances drawn for the Empire scene. **#11**, the brown earthy one, is the Mine at the bottom right of the east strip, below the Workshop.

| File | What |
| --- | --- |
| `sheet.png` | PixelLab Create Image Pro output: 5×5 candidates of 48×40 (240×200), with the scene as style |
| `cell/<n>.png` | Each candidate, sliced by the grid: n = row × 5 + column, from 0 at the top left. These touch across cells, so `candidates.py` can't separate them |
| `yard-cleared.png` | The 96×72 yard (world x 224–319, y 108–179) with the bush and crates painted out by PixelLab `inpaint_image` (55×44 mask at (29, 11)); the tree is kept |
| `on-lawn-3x.png` | Every candidate shown on the cleared yard where it would stand |

Prompt: "one mine entrance for a top-down RPG town, facing the viewer: a wide low grey rocky outcrop with a dark mine-shaft opening framed by a sturdy wooden timber frame, a short minecart rail track coming out to the front with a small wooden minecart of ore, a hanging lantern, chunky dark outline, few colors, the whole object fully visible and centered". Gallery: `gallery:f8c00f18-9a88-546d-b4df-ee00d321cb22`.

## How the Mine is placed

It first stood in the yard below the Exchange. It was moved to the east strip, and the yard went back to its crates (`design/scene/backup-before-mine/`).

1. **Restore:** the world starts from the backup.
2. **Move the Workshop:** its block (world x 360–460, y 38–140: building, woodpile, barrels, yard and anvil) moves up 30 px.
3. **Place the mine:** #11 goes in with its cell's top-left at world (426, 132).
4. **Repaint:** PixelLab `inpaint_image` repaints the rest on a 256×180 canvas at world x 224, using a custom mask: the band below the moved yard (x 340–479, y 111–179) minus the mine's pixels, plus two small seams at the top. It joined the road to the yard and added a dirt branch to the mine. The result is `design/scene/workshop-moved-mine-inpaint.png`.
5. **Hover outline:** `src/web/public/empire/mine.png` is #11 cropped to its pixels.

`yard-cleared.png` and `on-lawn-3x.png` are from the first placement, in the yard.
