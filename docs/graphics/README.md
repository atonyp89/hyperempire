# HyperEmpire — graphics and design

Art direction, the Empire scene, sprites and mocks. The files live in [`design/`](../../design/) (paths below are relative to it unless they start with `src/`); this page and [characters.md](characters.md) explain them.

## Art direction

- **Empire (current):** muted, earthy top-down RPG town: olive grass, dirt roads, big outlined red and slate roofs, stone plaza with statue pools, dark trees. The main scene is `scene/townhall-pixellab.png`, generated with PixelLab (Create Image Pro, style reference). Icons use Pixflux with the scene as a forced palette.
- **UI (current):** colours sampled from the scene: slate-navy panels with ink outlines and a bevel, wood title bars, parchment text, gold actions, teal selection (see `src/web/src/shared/styles/base.css`).
- **Earlier HyperHero explorations (kept for reference):** a chibi 32×32 knight and a dark-navy hero screen, below.
- **References (style only, not to copy):**
  - Top-down RPG town tileset image shared on Oct 25: the style the Empire scene follows
  - [Yield Fields](https://yieldfields.fun/): top-down island farm (an earlier scene exploration)
  - [Pixel art fantasy knight set (Shutterstock)](https://www.shutterstock.com/image-vector/pixel-art-fantasy-knight-warrior-character-2680707413): chibi proportions, shading ramps
  - [King Dies Rich (Steam)](https://store.steampowered.com/app/5377410/King_Dies_Rich/): hero/armory screen layout, palette, UI type

## Characters

[characters.md](characters.md) is the step-by-step process for making a character that fits the scene and walks it: PixelLab prompts and settings, the scripts, the checks and the pitfalls found with knight #5.

## Files

| Path | What |
| --- | --- |
| `hero-screen/Main.dc.html` | Hero screen mock (1280×800): equipment slots, trader card, knight on dais, stats with point allocation, adventure zones |
| `hero-screen/Economy.dc.html` | Pitch slide (1600×900): fees, the $aura game loop and the three player groups in one picture |
| `hero-screen/Scene.dc.html` | HyperEmpire main scene (1280×720): the pixel scene with building plates and a HUD |
| `hero-screen/canvas.json` | Canvas index for all artboards |
| `scene/empire_scene.py` | Generates the top-down town scene pixel art (320×180, scaled ×4; muted top-down RPG town style): `python3 empire_scene.py` |
| `scene/empire-scene.png`, `scene/empire-scene-1x.png` | The hand-drawn generator's scene at 1280×720 and at native 320×180 |
| `scene/cutout.py` | Cuts one building out of the scene as a transparent PNG for shape-following hover highlights: `python3 cutout.py townhall-pixellab-1x.png ../../src/web/public/empire/exchange.png 248 11 308 81` |
| `scene/cutout.py … --tree` | Tree mode: floods from the crop edges through everything except dark outline pixels, keeping what the outline encloses (used for `src/web/public/empire/trees/`) |
| `scene/cutout.py … --tree --cut-bottom` | For trees the scene's bottom edge cuts off (their outline is open there): skips the bottom row as a fill seed. Made `src/web/public/empire/trees/canopy1–3.png`, the three canopies over the bottom road |
| Walking behind | `OCCLUDERS` in `src/web/src/game/scene/Hero.tsx`: a building or tree whose roof or canopy covers road. The road under it is marked walkable in `walkable.png`, and while the hero's feet are above its ground line, its cut-out masks the hero, so it stays in front. Now the Marketplace (road copied back from `scene/backup-before-market/walkable.png`) and canopies 1–3 (road filled under each canopy row that has road on both sides). Rerunning `walkable.py` drops these patches; reapply them |
| `scene/world-480-1x.png`, `scene/world-480.png` | **The whole world** (480×180, and at 4×): the town (0–320, with the Marketplace below the Exchange) plus the east strip with the Workshop and Mine (320–480). Every layer in `src/web/public/empire/` (`town-base.png`, `night-lights.png`, `walkable.png`) is built at this size |
| `scene/archive-west-640/` | A 640-wide world with a big Garden in a west strip (Oct 26–28, 2026). Rolled back: the Garden will get its own screen instead; the art is kept for it. Its README covers how it was drawn |
| `scene/garden/field.py` | Builds the Garden screen's field, `src/web/public/empire/garden/field.png` (134×146): a fenced lawn with a 4×4 grid of 24 px plots every 30 px, cut from the town's own Garden (its furrowed plot shrunk with the edges kept, its fence repeated, plain lawn with blades). The Garden screen places its plot buttons with the same numbers (`GARDEN_FIELD` in `GardenField.tsx`). Wheat (`sprites/crops/`) is the test crop: `uv run --with pillow python3 field.py ../../../src/web/public/empire/town-base.png ../../../src/web/public/empire/garden/field.png` |
| `scene/garden/scene-1x.png` | **The Garden scene** (256×208), also `src/web/public/empire/garden/scene.png`: the field above pasted at (61, 31) on a plain lawn, then everything around it painted by PixelLab `inpaint_image` with a mask that keeps the field pixel-identical (so the plot buttons still line up): a dirt road looping round the fence and leaving at the bottom, a shed, a well, hay bales, a wheelbarrow, trees. Prompt: "top-down pixel art RPG farmyard around the fenced crop field in the centre, same muted earthy style: a wide tan dirt road runs all the way around the outside of the fence in a loop and leaves at the bottom edge…", seed 3. The other try (`garden/tries/b.png`: barn, scarecrow, pond, narrow path) was not used |
| `scene/garden/walkable.py` | The knight's road mask in the Garden, `src/web/public/empire/garden/walkable.png`: the road's tan, closed and flood-filled from the entrance at the bottom; the hay bales are blocked by hand. Rerun if the scene changes: `uv run --with pillow python3 walkable.py scene-1x.png ../../../src/web/public/empire/garden/walkable.png preview.png` |
| `scene/east-strip-inpaint.png` | How the east strip was made. Inpainting on Tier 1 stops at 256 px, so a 256×180 canvas held the town's last 96 columns plus 160 px of grass, and PixelLab `inpaint_image` redrew only that part (mask x 96, width 160). It continued the roads and added the Workshop. The kept columns came back pixel-identical, so the join is seamless. Extend again the same way, from this world's east edge |
| `scene/pine-removed-inpaint.png` | A 64×64 patch (world x 276–339, y 116–179) where PixelLab `inpaint_image` painted out a small pine that cut the bottom road, using an 18×17 mask at (23, 47). Pasted into `world-480-1x.png`, `town-base.png` and `town.png` |
| `scene/mine-inpaint.png` | First try at the Mine, painted straight into the yard below the Exchange. It came out cramped and was replaced by `sprites/mines-25/` #11 (`scene/mine-11.png`) |
| `scene/workshop-moved-mine-inpaint.png` | The east strip after the Workshop moved up 30 px and #11 went in at the bottom right: PixelLab `inpaint_image` with a custom mask repainted the road, grass and seams around them. See `sprites/mines-25/README.md` |
| `sprites/markets-front-16/` | **Marketplace library**: 16 front-facing market halls in the scene's style. #0 is the Marketplace, in the yard below the Exchange; its README covers the prompt, why two earlier sets were dropped, and how it was placed (backup in `scene/backup-before-market/`) |
| `sprites/mines-25/` | **Mine library**: 25 mine entrances in the scene's style, plus the cleared yard. #11 is the Mine; its README covers the prompt and how the Mine is placed |
| `scene/backup-before-mine/` | The world layers from before the Mine and the Workshop move, with how to roll back |
| `scene/walkable.py` | Builds the hero's road mask `src/web/public/empire/walkable.png` (white = walkable) from the scene: dirt-road and plaza-stone colours, cracks and notches closed, only roads connected to the hero's start kept, pools blocked. Rerun if the scene changes: `python3 walkable.py world-480-1x.png ../../src/web/public/empire/walkable.png preview.png` |
| `scene/night_lights.py` | Builds the night lights layer (`src/web/public/empire/night-lights.png`): lit windows, doorways, clock and lanterns from fixed boxes in the scene (update the boxes if the scene is regenerated) |
| `scene/remove_sprites.py` | Paints cut-outs out of the scene with neighbouring ground, so animated copies move without a ghost: makes `src/web/public/empire/town-base.png` |
| `scene/townhall-pixellab.png`, `scene/townhall-pixellab-1x.png` | **Current main scene**, generated with PixelLab (Create Image Pro, 320×180, style ref = the town reference), at 4× and native size |
| `src/web/public/empire/heroes/knight5/` | **Hero in the scene**: candidate #5 of `sprites/knights-64/` (Create Image Pro at 24×24 with the scene as style, about 23px tall), padded to 32×32 (`concept-5.png`), turned into 8 directions with create_character v3 (`rotations/`, `rotations.png` in S, SW, W, NW, N, NE, E, SE order) plus an idle made by hand (`idle.png`, 4 frames × 8 directions: 2 at rest, 2 with everything above the legs 1px lower; south comes from the original sprite, `idle-south/`) and a walk (`walk.png`, same layout) from PixelLab's walking-4-frames in skeleton-v3 mode, which moves the sprite instead of redrawing it (3 generations a direction). `sprites/pack_hero.py` packs both sheets with every direction's feet on the same row. PixelLab's template breathing-idle and walk redrew the body and dropped the sword, so they're kept in `raw/` unused. Drawn at 0.8× in the scene over `heroes/shadow.png`. PixelLab character: https://www.pixellab.ai/create-character/ff6ea1c1-ccf7-4fb0-967c-35ccf7e45e30 |
| `sprites/pack_hero.py` | Builds a hero's `idle.png` and `walk.png` (4 frames × 8 directions of 32×32) from `rotations/`, `idle-south/` and `walk/<dir>/`. Every direction is shifted so its feet stand on row 27 and its body is centred on column 16, since PixelLab draws the side views a pixel higher. Where the walk rides taller than the standing pose (the side views, whose skeleton walk straightens the legs), its body is lowered to standing height. So the hero doesn't float, jump or grow when it turns or starts walking: `python3 pack_hero.py ../../src/web/public/empire/heroes/knight5` |
| `sprites/farmers-64/` | **Farmer library**: 64 farmer villagers in the scene's style. #9 is the Farmer (`src/web/public/empire/farmers/farmer/`: 8 directions, idle and walk sheets, made with the knight's steps). Its README covers the prompt and steps |
| `sprites/knights-64/` | **Knight library**: 64 front-facing knights drawn for the scene, for future heroes and NPCs. `sheet.png` from PixelLab, `cut/<n>.png` cut-outs, `contact-5x.png` (n = row × 8 + column); its README covers the prompt and how to turn one into a character |
| `sprites/candidates.py` | Cuts Create Image Pro candidates out of a PixelLab sheet by connected pixels, so sprites that spill over their cell stay whole: `python3 candidates.py sheet.png 24 OUT_DIR` (or `40x24` for non-square cells) |
| `sprites/crops/` | **Crops**: wheat and grapes, each in 3 growth stages (16×16) plus seed and crop inventory icons (`src/web/public/empire/items/`), made with PixelLab; the first 4-stage wheat is kept in `wheat-v1/`. Its README has the steps |
| `sprites/signs-small-64/` | Signboard library: 64 blank town-size wooden signs (about 21×14) in the scene's style. Tried as building signs, then replaced by the name plates; kept for later. Its README has the prompt |
| `sprites/signs-64/` | An earlier, larger set (about 34×21), too big next to trees and fences; kept for bigger signs later |
| `src/web/public/empire/heroes/knight3/` | Town-size hero experiment (about 14px tall, not used): Create Image Pro at 20×20 with knight2 as the character reference and the scene as style (64 candidates, picked `concept-14.png`), padded to 32×32, turned with create_character v3 (rough at this size; only south is used) and breathing-idle. |
| `src/web/public/empire/heroes/knight2/` | Earlier hero (great helm), drawn in the scene's style: Create Image Pro at 32×32 with `scene/townhall-pixellab-1x.png` as the style image (64 candidates, picked `concept-58.png`; design described in words from a great-helm knight reference), padded to 48×48 and turned into 8 directions with create_character v3 (reference image), plus breathing-idle. `rotations.png` (S, SW, W, NW, N, NE, E, SE) and `idle-south.png`; shown in `/hero.html`. PixelLab character: https://www.pixellab.ai/create-character/291d15a5-0701-43b7-8530-0149926b8843 |
| `src/web/public/empire/heroes/knight/` | First hero prototype (64 px, finer pixels than the scene), PixelLab v3 character (64×64, low top-down, chibi knight described in words from the Shutterstock reference): `rotations/*.png` (8 directions), `idle-south/*.png` (breathing-idle, 4 frames), and the packed sheets `rotations.png` (S, SW, W, NW, N, NE, E, SE) and `idle-south.png`. Frames are recoloured onto the scene palette by `sprites/recolor.py`; the untouched PixelLab exports are in `raw/`. Preview: `/hero.html` on the dev server |
| `sprites/recolor.py` | Remaps sprite frames to the scene's 60 colours (nearest in OKLab, blues muted first, plus a skin ramp and two lighter roof-slate steps the scene lacks): `python3 recolor.py ../scene/townhall-pixellab-1x.png OUT_DIR frames…`, then rerun `sheet.py` |
| `sprites/sheet.py` | Packs same-size RGBA frames side by side into a spritesheet: `python3 sheet.py out.png 0.png 1.png …` |
| `sprites/knight-front.txt` | Current knight sprite as a character grid (palette in `sprites/render.py`) |
| `sprites/previews/knight-front.png` | Rendered preview of the current knight |
| `sprites/explorations/` | Earlier and rejected sprite versions |
| `sprites/render.py` | Renders a sprite grid to PNG: `python3 render.py knight-front.txt out.png 12` |

Live canvas: https://claude.ai/artifact/HLjGedth9eD96GUpHc2RAF (private; share from its Share menu).

The `.dc.html` files are Design canvas components (`<x-dc>` markup + `DCLogic` class); they render only inside the canvas editor. To view them in a normal browser, open the standalone builds:

| Path | What |
| --- | --- |
| `hero-screen/standalone/hero-screen.html` | Hero screen, fully interactive (stat points, level-up chance, reroll, zones) |
| `hero-screen/standalone/economy.html` | Pitch slide |
| `hero-screen/standalone/empire-scene.html` | HyperEmpire main scene |
| `hero-screen/build_standalone.py` | Rebuilds the standalone pages from the `.dc.html` files: `python3 build_standalone.py` |

After editing a `.dc.html`, rerun the build script so the standalone pages match. They load fonts from Google Fonts, so they need an internet connection to look right.
