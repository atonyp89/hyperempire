# Crops

Wheat, the Garden's first crop: three growth stages (16×16) for the field, and two inventory icons.

| What | File | Look |
| --- | --- | --- |
| Stage 0 | `src/web/public/empire/crops/wheat/0-sprout.png` | A Y of green blades on a brown mound |
| Stage 1 | `1-young.png` | A taller bunch of green blades (sways) |
| Stage 2 | `2-ripe.png` | A full golden bunch with grain heads (sways) |
| Field sheet | `src/web/public/empire/crops/wheat.png` | The three stages, 48×16, in order; used by the Garden screen and the town |
| Seed icon | `src/web/public/empire/items/wheat-seed.png` | A burlap sack with grain showing, 16×16 |
| Crop icon | `src/web/public/empire/items/wheat.png` | A tied wheat sheaf, 32×32 |

`wheat-v2/preview-6x.png` shows them all: the stages on a plot, then the two icons in slots.

## How wheat v2 was made (Oct 29, 2026)

1. **Sprout:** `create_1_direction_object` with the four 16×16 scene crops in `style/` as style images (64 candidates, 10 generations). Prompt: "a single young wheat sprout growing from a small mound of tilled brown soil: three or four short thin bright green blades…". Picked #7 of `wheat-v2-sprout-candidates/`.
2. **Young:** `create_object_state` on the sprout: "the same wheat plant grown taller: a fuller bunch of upright green leaf blades…, still green, no grain yet".
3. **Ripe:** states of the sprout or young came out wrong (a bright yellow-orange flame that also recoloured the mound, then thin wilted stalks; kept in `wheat-v2/ripe-tries/`). So ripe is its own `create_1_direction_object`, with the new young, the new sprout and the old ripe frame as style images: "a single ripe wheat plant: a full bunch of tall muted golden-tan wheat stalks with plump drooping grain heads…". Picked #13 of `wheat-v2-ripe-candidates/`.
4. **Icons:** `create_image_pro` at 32×32, `max_colors` 16, with the town's buildings (world x 240–479, y 0–95) as style: "inventory item icon for a farming RPG: a harvested wheat sheaf…" (picked #0 of `../items/wheat-sheaf-icon-candidates/`) and "…a small tied burlap sack of wheat seeds, the open top showing pale golden grains…" (#0 of `../items/wheat-seed-icon-candidates/`). Each seed candidate held two small sacks; the bottom-right one was cropped and centred on 16×16. A first try at both icons with `create_1_direction_object` at 16×16 came out blobby (`wheat-seed-candidates/`, `wheat-sheaf-candidates/`).

PixelLab objects: sprout `c4cbcec1-1ac4-42d1-9dd4-0be2a96d9770`, young `d4053141-9fac-463e-8502-1abd7de645a7`; ripe candidates `c1dfc0a2-023b-440f-8052-6c62dda07daa`. Gallery assets: sheaf icons `f3962870-f38a-5d43-924e-c807e10a15b3`, seed icons `e060db57-888c-5876-8c28-43f29e6ed023`.

## Wheat v1 (replaced)

The first wheat had four stages (seed mound, sprout, young, ripe) and no inventory icons; it's kept in `wheat-v1/` (`wheat-v1.png` was the sheet). It was made the same way as the v2 sprout and young. They all come from one PixelLab object, so every stage is the same plant on the same canvas.

1. **Base:** `create_1_direction_object` drew the sprout stage, with style images instead of a size.
   - **Style images:** four 16×16 crops of the scene, in `style/`: bush, tree, grass and the garden's soil. Their size sets the output to 16×16 and 64 candidates, for 10 generations.
   - **Prompt:** "a single young green wheat plant growing from a small mound of tilled soil, a few upright leaf blades, top-down RPG farm crop, chunky dark outline, centered, isolated, transparent background".
   - **Pick:** candidate #3, chosen from `wheat-candidates/`.
2. **Other stages:** `create_object_state` made each one from that base, keeping the plant's identity:
   - **Seed:** "the same soil mound just after planting: no plant yet, only a few tiny pale seeds…"
   - **Young:** "…grown taller: a fuller bunch of upright green leaf blades…, no grain yet"
   - **Ripe:** "…fully grown and ripe: tall golden yellow stalks with plump golden grain heads…"
3. **Ripe colour:** PixelLab's ripe wheat came out bright yellow; the original is in `wheat-v1/raw/`. It was recoloured to the scene palette (`../recolor.py`), then toned down by hand: `#fcd66b` → `#e5af5f`, `#e5af5f` → `#a6936d`.

PixelLab objects: base `92c0c9c1-7aac-43be-962a-286ca63c277f`; states seed `03bd3068-…`, young `efa9f36e-…`, ripe `800e083a-…`.

## Another crop

Make a sprout, then its young and ripe stages (from the sprout, or as their own objects with the earlier stages as style), and pack them into `src/web/public/empire/crops/<crop>.png`. Make a seed icon and a crop icon in `src/web/public/empire/items/`. Then add the crop to `CROPS` in `src/server/src/rules/garden.ts` with its `stages`, `sprite`, `icon` and `seedIcon`.
