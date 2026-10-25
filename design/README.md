# HyperEmpire — design

## Art direction

- **Empire (current):** muted, earthy top-down RPG town: olive grass, dirt roads, big outlined red and slate roofs, stone plaza with statue pools, dark trees. The main scene is `scene/townhall-pixellab.png`, generated with PixelLab (Create Image Pro, style reference). Icons use Pixflux with the scene as a forced palette.
- **UI (current):** colours sampled from the scene: slate-navy panels with ink outlines and a bevel, wood title bars, parchment text, gold actions, teal selection (see `src/web/src/styles.css`).
- **Earlier HyperHero explorations (kept for reference):** a chibi 32×32 knight and a dark-navy hero screen, below.
- **References (style only, not to copy):**
  - Top-down RPG town tileset image shared on Oct 25: the style the Empire scene follows
  - [Yield Fields](https://yieldfields.fun/): top-down island farm (an earlier scene exploration)
  - [Pixel art fantasy knight set (Shutterstock)](https://www.shutterstock.com/image-vector/pixel-art-fantasy-knight-warrior-character-2680707413): chibi proportions, shading ramps
  - [King Dies Rich (Steam)](https://store.steampowered.com/app/5377410/King_Dies_Rich/): hero/armory screen layout, palette, UI type

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
| `scene/night_lights.py` | Builds the night lights layer (`src/web/public/empire/night-lights.png`): lit windows, doorways, clock and lanterns from fixed boxes in the scene (update the boxes if the scene is regenerated) |
| `scene/remove_sprites.py` | Paints cut-outs out of the scene with neighbouring ground, so animated copies move without a ghost: makes `src/web/public/empire/town-base.png` |
| `scene/townhall-pixellab.png`, `scene/townhall-pixellab-1x.png` | **Current main scene**, generated with PixelLab (Create Image Pro, 320×180, style ref = the town reference), at 4× and native size |
| `src/web/public/empire/heroes/knight5/` | **Hero in the scene**: candidate #5 of `sprites/knights-64/` (Create Image Pro at 24×24 with the scene as style, about 23px tall), padded to 32×32 (`concept-5.png`), turned into 8 directions with create_character v3 (`rotations/`, `rotations.png` in S, SW, W, NW, N, NE, E, SE order) plus an idle made by hand from the original sprite (`idle-south.png`, 4 frames: 2 at rest, 2 with everything above the legs 1px lower). PixelLab's breathing-idle redrew the body and shrank the sword, so it's kept in `raw/` unused. Drawn 1:1 in the scene over `heroes/shadow.png`. PixelLab character: https://www.pixellab.ai/create-character/ff6ea1c1-ccf7-4fb0-967c-35ccf7e45e30 |
| `sprites/knights-64/` | **Knight library**: 64 front-facing knights drawn for the scene, for future heroes and NPCs. `sheet.png` from PixelLab, `cut/<n>.png` cut-outs, `contact-5x.png` (n = row × 8 + column); its README covers the prompt and how to turn one into a character |
| `sprites/candidates.py` | Cuts Create Image Pro candidates out of a PixelLab sheet by connected pixels, so sprites that spill over their cell stay whole: `python3 candidates.py sheet.png 24 OUT_DIR` |
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
