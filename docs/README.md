# HyperEmpire — documentation

Four areas, each in its own folder.

## [Gameplay guide](gameplay/)

The player-facing guide to the game as it is today, published with GitBook (`.gitbook.yaml` at the repo root points Git Sync at this folder; `SUMMARY.md` is its table of contents). It describes what players see and do; the rules and reasoning behind them stay in the economy docs. Update it whenever a change is visible to players.

## [Game economy](economy/)

What the game is and how its economy works: what players do, what earns and burns $aura, prices and odds.

| Doc | What |
| --- | --- |
| [game-design.md](economy/game-design.md) | The game design: player types, buildings, $aura economy, Townhall and Mastery, mining, heroes, crafting, leaderboard, Season 0 rules, roadmap, current status, open questions |
| [decisions.md](economy/decisions.md) | How each rule was decided and why, with the farming math and the builder-fee comparison |

## [Graphics and design](graphics/)

How the game looks and how its art is made. The art files themselves are in [`design/`](../design/).

| Doc | What |
| --- | --- |
| [README.md](graphics/README.md) | Art direction, references, and every scene layer, sprite library, generator script and mock |
| [characters.md](graphics/characters.md) | Step by step: making a walking character for the Empire scene with PixelLab |

## [Backend API](backend/)

How the game runs: the HyperEmpire API, its data and its endpoints.

| Doc | What |
| --- | --- |
| [README.md](backend/README.md) | Architecture, where it runs (browser in development, AWS in production), sign-in, the $aura ledger, fees, Townhall, mining blocks, data model, the admin dashboard, errors, and the planned on-chain parts |
| [endpoints.md](backend/endpoints.md) | Every endpoint, with requests, responses and errors |
| [src/server/README.md](../src/server/README.md) | Running, testing and deploying the server |

Keep each fact in one place: rules and numbers in the economy docs, art in graphics, how the code does it in backend. Link instead of repeating. The gameplay guide is the exception: it restates numbers for players, so check it when economy numbers change.
