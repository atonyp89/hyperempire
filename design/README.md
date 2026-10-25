# Degen Empire — design

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
| `hero-screen/Scene.dc.html` | Degen Empire main scene (1280×720): the pixel scene with building plates and a HUD |
| `hero-screen/canvas.json` | Canvas index for all artboards |
| `scene/empire_scene.py` | Generates the top-down town scene pixel art (320×180, scaled ×4; muted top-down RPG town style): `python3 empire_scene.py` |
| `scene/empire-scene.png`, `scene/empire-scene-1x.png` | The hand-drawn generator's scene at 1280×720 and at native 320×180 |
| `scene/cutout.py` | Cuts one building out of the scene as a transparent PNG for shape-following hover highlights: `python3 cutout.py townhall-pixellab-1x.png ../../src/web/public/empire/exchange.png 248 11 308 81` |
| `scene/townhall-pixellab.png`, `scene/townhall-pixellab-1x.png` | **Current main scene**, generated with PixelLab (Create Image Pro, 320×180, style ref = the town reference), at 4× and native size |
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
| `hero-screen/standalone/empire-scene.html` | Degen Empire main scene |
| `hero-screen/build_standalone.py` | Rebuilds the standalone pages from the `.dc.html` files: `python3 build_standalone.py` |

After editing a `.dc.html`, rerun the build script so the standalone pages match. They load fonts from Google Fonts, so they need an internet connection to look right.
