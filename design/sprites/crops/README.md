# Crops

The Garden's crops: wheat and grapes, each with three growth stages (16×16) for the field and two inventory icons.

| What | File | Look |
| --- | --- | --- |
| Stage 0 | `src/web/public/empire/crops/wheat/0-sprout.png` | A Y of green blades on a brown mound |
| Stage 1 | `1-young.png` | A taller bunch of green blades (sways) |
| Stage 2 | `2-ripe.png` | A full golden bunch with grain heads (sways) |
| Field sheet | `src/web/public/empire/crops/wheat.png` | The three stages, 48×16, in order; used by the Garden screen and the town |
| Seed icon | `src/web/public/empire/items/wheat-seed.png` | A burlap sack with grain showing, 16×16; the slot's border colours it by grade |
| Pack icon | `src/web/public/empire/items/wheat-pack.png` | A paper seed packet, 32×32 (see Seed packs) |
| Crop icon | `src/web/public/empire/items/wheat.png` | A tied wheat sheaf, 32×32 |

`wheat-v2/preview-6x.png` shows them all: the stages on a plot, then the two icons in slots.

## How wheat v2 was made (Oct 29, 2026)

1. **Sprout:** `create_1_direction_object` with the four 16×16 scene crops in `style/` as style images (64 candidates, 10 generations). Prompt: "a single young wheat sprout growing from a small mound of tilled brown soil: three or four short thin bright green blades…". Picked #7 of `wheat-v2-sprout-candidates/`.
2. **Young:** `create_object_state` on the sprout: "the same wheat plant grown taller: a fuller bunch of upright green leaf blades…, still green, no grain yet".
3. **Ripe:** states of the sprout or young came out wrong (a bright yellow-orange flame that also recoloured the mound, then thin wilted stalks; kept in `wheat-v2/ripe-tries/`). So ripe is its own `create_1_direction_object`, with the new young, the new sprout and the old ripe frame as style images: "a single ripe wheat plant: a full bunch of tall muted golden-tan wheat stalks with plump drooping grain heads…". Picked #13 of `wheat-v2-ripe-candidates/`.
4. **Icons:** `create_image_pro` at 32×32, `max_colors` 16, with the town's buildings (world x 240–479, y 0–95) as style: "inventory item icon for a farming RPG: a harvested wheat sheaf…" (picked #0 of `../items/wheat-sheaf-icon-candidates/`) and "…a small tied burlap sack of wheat seeds, the open top showing pale golden grains…" (#0 of `../items/wheat-seed-icon-candidates/`). Each seed candidate held two small sacks; the bottom-right one was cropped and centred on 16×16. A first try at both icons with `create_1_direction_object` at 16×16 came out blobby (`wheat-seed-candidates/`, `wheat-sheaf-candidates/`).

PixelLab objects: sprout `c4cbcec1-1ac4-42d1-9dd4-0be2a96d9770`, young `d4053141-9fac-463e-8502-1abd7de645a7`; ripe candidates `c1dfc0a2-023b-440f-8052-6c62dda07daa`. Gallery assets: sheaf icons `f3962870-f38a-5d43-924e-c807e10a15b3`, seed icons `e060db57-888c-5876-8c28-43f29e6ed023`.

## Grapes (Oct 29, 2026)

A grape vine on a short wooden stake, in the same three stages, plus its icons. `grapes/preview-6x.png` shows the stages on a plot and all four item icons (wheat and grapes) in slots.

| What | File |
| --- | --- |
| Stages | `src/web/public/empire/crops/grapes/0-sprout.png`, `1-young.png`, `2-ripe.png`; sheet `src/web/public/empire/crops/grapes.png` (48×16) |
| Seed icon | `src/web/public/empire/items/grapes-seed.png` (16×16) |
| Crop icon | `src/web/public/empire/items/grapes.png` (32×32) |

1. **Sprout:** `create_1_direction_object`, style images: the wheat v2 sprout and ripe frames plus the soil and bush crops from `style/`. "a young grape vine just planted: a short thin wooden stake in a small mound of dark brown tilled soil, with a small green vine shoot curling up it…". Picked #9 of `grapes-sprout-candidates/`.
2. **Young:** `create_object_state` on the sprout: "the same grape vine grown bigger: the green vine now climbs to the top of the same wooden stake with several more broad green leaves, still no grapes…" (`grapes/young-tries/a.png`; `b.png`, with tiny green buds, looked too close to the sprout).
3. **Ripe:** its own `create_1_direction_object` with the same style images: "a ripe grape vine: a short wooden stake…, a leafy green vine wrapped around it with two plump bunches of deep purple grapes hanging from it…". Picked #13 of `grapes-ripe-candidates/`.
4. **Grapes icon:** `create_image_pro` 32×32, `max_colors` 16, with the two wheat icons as the style image. Its sheet came back shifted half a cell, so the 64 tiles were stitched into `../items/grapes-icon-candidates/sheet.png`, rolled 16 px and cut again into `cut/`. Picked #0.
5. **Seed icon:** `create_image_pro` 16×16 with the wheat seed sack as a labelled reference ("the seed sack: same shape, size, burlap colour and outline"): "the same small burlap seed sack…, but its open top shows small dark purple grape seeds…, with a tiny purple grape tag". Picked #2.

PixelLab objects: sprout `69902638-5b48-4df1-8a1b-1216c86c1052`, young `3de99b61-1c97-493f-b122-3c7acf17c21b`; ripe candidates `85498bc0-43be-4d2d-8d8a-7c774a506cfb`. Gallery assets: icons `be887058-dc43-5fca-9cb2-504107c18685`, seed icons `60414271-c2c1-5339-84e9-3bf5e5c85001`.

## Seed packs (Oct 29, 2026)

`src/web/public/empire/items/wheat-pack.png` and `grapes-pack.png` (32×32): cream paper envelopes with the crop printed on the front. `create_image_pro` 32×32, `max_colors` 16, with the wheat icons as the style image: "a sealed paper seed packet, a small cream-coloured paper envelope with a folded top edge, showing a simple printed picture of golden wheat stalks (or a bunch of purple grapes) on its front…". Both sheets came back shifted half a cell; the 64 tiles were stitched into `../items/<crop>-pack-icon-candidates/sheet.png`, rolled 16 px and cut into `cut/`. Picked #0 of each. Gallery assets: wheat `6c55a173-11ec-59a5-8c9e-c2efbf8a403c`, grapes `bf499978-dbc3-5899-972f-3b729a29fc50`.

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
