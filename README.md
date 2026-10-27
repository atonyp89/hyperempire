# HyperEmpire

Trade on Hyperliquid, grow a pixel-art empire. Every builder fee you pay through the Exchange earns $aura; $aura levels up your Townhall, earns perk points, unlocks new buildings and climbs the Season 0 leaderboard. Your empire is your trader identity card.

## Contents

| Path | What |
| --- | --- |
| [docs/](docs/README.md) | All documentation, in three areas: |
| [docs/economy/](docs/economy/game-design.md) | **Game economy:** the game design ($aura, buildings, perks, mining, heroes, leaderboard) and the [decisions log](docs/economy/decisions.md) |
| [docs/graphics/](docs/graphics/README.md) | **Graphics and design:** art direction, the Empire scene, sprites and how [characters](docs/graphics/characters.md) are made. Art files are in [design/](design/) |
| [docs/backend/](docs/backend/README.md) | **Backend API:** architecture, logic, data model and [endpoints](docs/backend/endpoints.md) |
| [src/web/](src/web/README.md) | The app: Empire scene, Exchange (Hyperliquid perps with our builder code) and Townhall screens |
| [src/server/](src/server/README.md) | The API: wallet sign-in, the $aura ledger, Townhall and mining. Runs inside the browser while developing, on a server in production |

## Run the app

```bash
cd src/server && bun install && cd ../web && bun install && bun --bun run dev
```

The API runs inside the browser by default (`VITE_API_URL=local`), so there's nothing else to start.

Copy `src/web/.env.example` to `src/web/.env` and set the builder address first. See [src/web/README.md](src/web/README.md).
