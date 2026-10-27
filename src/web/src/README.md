# Code structure

The web app has two parts that must not break each other. Trading handles real money, so it's walled off from the game.

| Folder | What | May import |
| --- | --- | --- |
| `trading/` | Hyperliquid trading: API client, orders, agent key, onboarding, markets and account data, the trading terminal UI (market header and dropdown, order book, order form, account tabs) and `trading.css` | `shared/` only |
| `game/` | Game and general UI: header, Empire scene (ambient life, time of day, hero), buildings (Townhall, the Exchange frame), game hooks, and `game.css` | `shared/`, and trading only through `trading/index.ts` |
| `shared/` | What both need: the network choice (`network.ts`), the API client (`api.ts`) and sign-in (`session.ts`), storage, display formatting, wallet config (`wagmi.ts`), the building modal frame, error boundaries and the base styles (`styles/base.css`) | Nothing in `trading/` or `game/` |
| `App.tsx`, `main.tsx` | Composition: mounts the game and the Exchange, each behind its own error boundary | Like `game/` |
| `admin/` | The admin dashboard page (`admin.html`): database overview, tables and read-only SQL, styled in `admin.css` under `.admin` | `shared/` only |
| `@server/…` | The API in `../../server/src` (see [its README](../../server/README.md)) | Web code imports only `@server/contract` (request/response shapes and game rules); only `shared/api.ts` imports `@server/local` |

## The rules, and what checks them

`architecture.test.ts` runs with `bun test` and fails when any of these break:

1. **`trading/` never imports `game/` or `App`.** Game changes can't reach trading code.
2. **Outside `trading/`, code uses only `trading/index.ts`.** It exports `TradingTerminal`, `captureReferral` and the fee and $aura constants. Anything else in `trading/` can change freely. If the game needs something new from trading, export it from `index.ts` on purpose.
3. **`shared/` imports neither part.** Keep it small: only what both truly need.
4. **The server stays separate.** Web code imports `@server/contract` and nothing else from the server (plus `@server/local` in `shared/api.ts`), and no server file imports web code. Game state (balances, Townhall, mining) is read and changed only through the API, never computed in the browser.
5. **Every rule in a stylesheet under `trading/` starts with `.trading`, and under `game/` with `.game`.** A game rule like `.tabs` or `table` can't restyle the order form, and the other way round. `shared/styles/base.css` holds the theme colours and primitives (`.btn`, `.input`, `.panel`, `.chip`, `.notice`, the modal frame). A change there shows up in both, so treat it like an API.

## Crashes stay local

`shared/ui/ErrorBoundary.tsx` wraps each part:

- **The game:** the header, the scene and the Townhall each have their own boundary. A broken scene leaves the header, and with it the Exchange link, working.
- **The Exchange:** the Exchange frame has one around the whole trading terminal.
- **Inside the terminal:** the market header, account tabs, order book and order form each have one. If the order book breaks, the order form still sends orders.

Each fallback says what broke and offers TRY AGAIN, which re-mounts that part.

## Adding things

- **Trading feature:** put it in `trading/`, styled in `trading.css` under `.trading`. It must not need anything from `game/`.
- **Game feature that shows trading data:** add a hook or value to `trading/index.ts` and use that.
- **Game feature with state or rules:** add a route under `server/src/routes/`, its shapes to `server/src/contract.ts`, a test to `server/src/app.test.ts`, and a react-query hook in `game/hooks/` that calls it with `useSession().call`.
- **Code both parts need:** put it in `shared/`, and only if it has no trading or game logic in it.
