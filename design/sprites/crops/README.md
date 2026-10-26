# Crops

Wheat growing in the Garden (`src/web/src/game/scene/Garden.tsx`), in four stages of 16×16:

| Stage | File | Look |
| --- | --- | --- |
| 0 | `src/web/public/empire/crops/wheat/0-seed.png` | Tilled soil mound with seeds |
| 1 | `1-sprout.png` | A few green blades |
| 2 | `2-young.png` | Fuller green plant (sways) |
| 3 | `3-ripe.png` | Golden wheat heads (sways) |

They're packed into `src/web/public/empire/crops/wheat.png` (64×16, in stage order) with `../sheet.py`. Each frame's mound sits on row 14.

## How they were made

They all come from one PixelLab object, so every stage is the same plant on the same canvas.

1. **Base:** `create_1_direction_object` drew the sprout stage, with style images instead of a size.
   - **Style images:** four 16×16 crops of the scene, in `style/`: bush, tree, grass and the garden's soil. Their size sets the output to 16×16 and 64 candidates, for 10 generations.
   - **Prompt:** "a single young green wheat plant growing from a small mound of tilled soil, a few upright leaf blades, top-down RPG farm crop, chunky dark outline, centered, isolated, transparent background".
   - **Pick:** candidate #3, chosen from `wheat-candidates/`.
2. **Other stages:** `create_object_state` made each one from that base, keeping the plant's identity:
   - **Seed:** "the same soil mound just after planting: no plant yet, only a few tiny pale seeds…"
   - **Young:** "…grown taller: a fuller bunch of upright green leaf blades…, no grain yet"
   - **Ripe:** "…fully grown and ripe: tall golden yellow stalks with plump golden grain heads…"
3. **Ripe colour:** PixelLab's ripe wheat came out bright yellow; the original is in `wheat/raw/`. It was recoloured to the scene palette (`../recolor.py`), then toned down by hand: `#fcd66b` → `#e5af5f`, `#e5af5f` → `#a6936d`.

PixelLab objects: base `92c0c9c1-7aac-43be-962a-286ca63c277f`; states seed `03bd3068-…`, young `efa9f36e-…`, ripe `800e083a-…`.

## Another crop

Follow the same steps with a new prompt, then pack its four stages into `<crop>.png`. In `Garden.tsx`, give each plant a crop type and point `.crop` at that sheet in `game.css`.
