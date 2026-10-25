# Degen Empire

Trade on Hyperliquid, grow a pixel-art empire. Every builder fee you pay through the Exchange earns $aura; $aura levels up your Townhall, earns perk points, unlocks new buildings and climbs the Season 0 leaderboard. Your empire is your trader identity card.

## Contents

| Path | What |
| --- | --- |
| [docs/mvp-design.md](docs/mvp-design.md) | Game design: player types, buildings (Townhall, Exchange, Tavern, Garden), $aura economy, perk tree, heroes, crafting, leaderboard, architecture, current status, open questions |
| [docs/decisions.md](docs/decisions.md) | How the rules were decided, including the HyperHero → Degen Empire pivot, farming math and builder fee comparison |
| [design/](design/README.md) | Art direction, the PixelLab Empire scene and cut-outs, mocks, sprites and their generators |
| [src/web/](src/web/README.md) | The app: Empire scene, Exchange (Hyperliquid perps with our builder code) and Townhall screens |

## Run the app

```bash
cd src/web && bun install && bun --bun run dev
```

Copy `src/web/.env.example` to `src/web/.env` and set the builder address first. See [src/web/README.md](src/web/README.md).
