# 16 markets

Market halls drawn for the Empire scene, facing the viewer like the other buildings. **#0**, a cream plaster gable with a round emblem, a striped awning and a produce counter, is the Marketplace in the yard below the Exchange.

| File | What |
| --- | --- |
| `cell/<n>.png` | PixelLab Create Image Pro output: 16 candidates of 64×64, `max_colors` 28, with the Exchange and Workshop sprites as labelled references |
| `vs-exchange-3x.png` | Each candidate between the Exchange and the Workshop |
| `in-town-2x.png` | Each candidate placed where the Marketplace stands |

Prompt: "one market hall building for a top-down RPG town, seen straight from the front and from above exactly like the reference buildings: perfectly front-facing and symmetrical, not rotated, no corner view, the roof's front gable faces the viewer and the roof slopes are seen from above. A big dark slate-blue gable roof with clear tile rows, cream plaster walls with dark timber frame, a wide open front with a red and cream striped cloth awning across the whole front over a wooden counter with produce, two crates at the front corners. Clean crisp pixel art like the references: thick dark outline, flat cel shading, large readable shapes, no dithering, no noise. The whole building fully visible and centered". References: `exchange.png` ("camera angle, front-facing symmetry, size, outline and shading style") and `workshop.png` ("camera angle and timber building style"). Gallery asset: `4788fd74-d3a7-51b4-94f9-942b114414bf`.

**What made it match:** two earlier sets were dropped. The first (the whole scene as style, no colour cap) was soft and dithered, with about 60 colours. The second (a colour cap and a buildings-only style image) was crisper but drawn at a corner angle, and still looked busier than its neighbours in town. Passing the Exchange and Workshop sprites as *reference images* (not just a style image) gave the same camera, the same outline weight and about the same detail density: 0.41–0.45 colour changes per pixel, against 0.43 for the Exchange and 0.42 for the Workshop.

## How the Marketplace is placed

1. **Start from the backup:** `scene/backup-before-market/` holds the world layers from before.
2. **Clear the yard:** the crates and bush patch of `../mines-25/yard-cleared.png` (its 55×44 box at (29, 11), world (253, 119)) is pasted in.
3. **Remove the small tree** at world (239, 119): its ground comes from `town-base.png` (where it was already painted out), its leftover shadow is filled with lawn green, and `trees/tree3.png` is gone from `Ambient.tsx`.
4. **Place the building:** #0, cropped to its pixels (58×60), goes in at world (255, 101). The same crop is `src/web/public/empire/market.png`, the hover outline.
5. **Walkable:** `scene/walkable.py` rerun, then the old mask's road pixels under the roof (world x 255–312, y 101–125, from `scene/backup-before-market/walkable.png`) are copied back. The dirt path from the left road to the Exchange door runs behind the Marketplace, so the hero can still walk it. Rerunning `walkable.py` alone would cut it again.
6. **Walking behind it:** `OCCLUDERS` in `src/web/src/game/scene/Hero.tsx` lists the Marketplace. While the hero's feet are above its ground line (y 158), the hero and its shadow are CSS-masked by `market.png`, so the roof stays in front at every time of day.
