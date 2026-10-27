# HyperEmpire web app

Phase 1 trading frontend. Users trade Hyperliquid perps through HyperEmpire's builder code, and every fill shows the $aura it earned (500 $aura per $1 of builder fee).

## Run

Vite 8 needs Node 20.19+ (or 22.12+). With the Node on this machine (20.18), run it through Bun:

```bash
bun install && (cd ../server && bun install)   # the web app bundles the server for local mode
bun --bun run dev        # http://localhost:5173
bun --bun run build
bun test                 # price/size rounding and $aura math
bun run typecheck
```

Copy `.env.example` to `.env.local` and set `VITE_BUILDER_ADDRESS`. Until it is set, markets load but trading is disabled.

**Testnet / Mainnet:** the header toggle switches networks; switching to mainnet asks first. `VITE_HL_NETWORK` is only the default. The choice is saved in the browser (`hyperempire.network`) and the page reloads, because the API client, trading keys and Townhall progress are all per network. Both networks use the same builder wallet (`VITE_BUILDER_ADDRESS`). The builder approval and the trading key are separate on each network, so players go through the one-time setup again the first time they trade on mainnet, and the builder needs its 100 USDC on each network it's used on.

## Screens

- **Empire scene** (`/`): a 640×180 world (`design/scene/world-640-1x.png`, copied to `public/empire/town.png`): a west strip with the big Garden, the original town, and an east strip with the Workshop and Mine. The scene box fills the window: 320×180 of the world on a 16:9 screen, wider on wide screens, up to the whole 480; the camera in `game/scene/Hero.tsx` eases after the knight and slides the world (in whole screen pixels, so the pixel art doesn't shimmer). Sizes are in `game/scene/world.ts`. Buildings are hotspots: the **Exchange** opens trading, the Townhall opens progress, and the Tavern, Garden, Mine and Workshop say what's coming. The Mine, at the bottom right below the Workshop, is where players will send their miners for resources such as BTC, ETH or oil.
- **Garden** (`game/scene/Garden.tsx`): 47 wheat plants across the big fenced Garden's seven plots, each going seed → sprout → young → ripe, then back to seed, one stage every 18 s. They start out of step so the field always shows a mix, and young and ripe wheat sways. Sprites are in `public/empire/crops/wheat.png`, from PixelLab; see `design/sprites/crops/`.
- **Name plates** (`game/scene/EmpireScene.tsx`): each building has a pixel-font plate with its name in the middle of the building (or at its `plate` point, set for the Exchange and Tavern), gold when open. Hovering or focusing the building lights its outline and expands the plate with a short tag and what the building does (`about` in `BUILDINGS`).
- **Ambient life** (`game/scene/Ambient.tsx`): three cut-out trees sway from the trunk, wind streaks drift across, and every 7–13 s a gust bends the trees harder and blows 6–10 pixel leaves over the town. The scene image is `public/empire/town-base.png` (the PixelLab town with those trees painted out). All motion stops under `prefers-reduced-motion`.
- **Hero** (`game/scene/Hero.tsx`): knight #5 starts on the plaza in front of the Townhall door. **WASD or the arrow keys** walk it around the town in 8 directions at 42 scene px/s, snapped to the scene's pixel grid, drawn at 0.8×. It can only walk on the roads: `public/empire/walkable.png` (from `design/scene/walkable.py`) marks the plaza, the path between the pools and the dirt roads, the feet (5px wide) must stay on it, and a blocked diagonal slides along the road edge. Keys are ignored while a building screen is open or a text field has focus. Sheets in `public/empire/heroes/knight5/` are 4 frames × 8 directions of 32×32: `walk.png` (PixelLab skeleton walk, 0.56s loop) and `idle.png` (head, torso and sword dip 1px, 1.6s loop), over an 8×2 pixel shadow (`heroes/shadow.png`). The hero sits above the hotspots so hover highlights never hide it, lets clicks through, and takes a per-phase filter in place of the time-of-day washes.
- **Time of day** (`game/hooks/useDayPhase.ts`, `game/scene/TimeOfDay.tsx`): follows the player's local clock. Morning (05:00–11:59) adds a soft-light golden grade (keeps pixel contrast), a sun glow, slow diagonal sunbeams, drifting motes, and warm sun glints twinkling on both pools; evening (12:00–18:59) is the scene as painted; night (19:00–04:59) tints the town dark blue and turns on `public/empire/night-lights.png` (lit windows, doorways, clock, lanterns), flickering lamp glows, fireflies, moonlight from the top-right and a silver moonpath of glints on the pools. The header chip shows the phase; clicking it cycles Auto → Morning → Evening → Night to preview (saved in the browser).
- **Townhall modal** (`/#townhall`): level, $aura progress, risky upgrade (pay 10–100% of the cost for that chance), the three-branch perk tree (Trader live; Fighter and Crafter bank points for Phases 2–3), respec and building caps. Rules live in `src/server/src/rules/empire.ts` (the web app reads them through `@server/contract`). Progress and the $aura balance (5,000 starter + 500 per $1 of builder fee − spending) are kept by the API: the player signs one message (**SIGN IN** in the header), and `useTownhall` reads and changes the Townhall through it. In development the API runs inside the browser; see **API** below. Perk icons in `public/empire/icons/` were generated with PixelLab (Pixflux, scene palette).
- **Exchange modal** (`/#exchange`, also the header's EXCHANGE link): the trading UI, nearly full screen (up to 1800×980), in three columns. On the left are the market header and account tabs; the market name is a dropdown with search, and Enter picks the first match. In the middle is the **order book**, and on the right the order form. `#exchange` deep-links straight in for players who only trade; Escape or ✕ closes it.
- **Order book** (`trading/components/OrderBook.tsx`): 12 asks above the spread and 12 bids below, with price, size and cumulative total in coin or USD over depth bars. It polls `l2Book` every second. Clicking a row switches the order form to Limit at that price.
- **Order form** (`trading/components/OrderPanel.tsx`, math in `trading/lib/orderMath.ts`): laid out like Hyperliquid's (without its Pro order types).
  - **Margin mode and leverage:** CROSS / ISOLATED and leverage buttons open small dialogs that apply the change on Hyperliquid right away (`updateLeverage`).
  - **Order:** Market or Limit (with a MID button and GTC / IOC / ALO time in force), and Buy / Long or Sell / Short.
  - **Size:** in USD or coin, with a 0–100% slider of the max trade size.
  - **Options:** reduce only, and TP/SL set by price or by gain/loss on margin, the two kept in sync.
  - **Summary:** estimated liquidation price, order value, margin required, slippage (estimated from the live book, against the 3% max), the account's own taker and maker fees plus the builder fee, and the $aura earned.
  - **Dev preview:** on the dev server, `/?order-preview#exchange` shows the form without a wallet (zero-address account, nothing can be sent).

The theme in `src/shared/styles/base.css` uses colours sampled from the Empire scene (slate, wood, parchment, gold, teal, grass, roof red), so the modal matches the town.

## How trading works

1. **Connect** an injected wallet (MetaMask, Rabby…).
2. **Approve builder fee** (one signature): `approveBuilderFee` for `VITE_BUILDER_MAX_FEE_RATE` (0.1%, the perps cap), so the fee can rise later without asking again.
3. **Enable trading** (one signature): a trading key is generated in the browser (`localStorage`) and approved with `approveAgent`. Browser wallets can't sign Hyperliquid L1 actions directly, so the agent signs orders. An agent can trade but never withdraw.
4. **Trade**: every order, close and TP/SL carries `builder: { b: VITE_BUILDER_ADDRESS, f: VITE_BUILDER_FEE_TENTHS_BPS }` (50 = 0.05% at launch).

Both approvals are signatures, not transactions, so they cost no gas. The account needs USDC on Hyperliquid first. The builder address must hold at least 100 USDC in its perps account before Hyperliquid accepts it.

**API:** game state (the $aura balance, Townhall, and mining next) lives behind the HyperEmpire API in [src/server](../server/README.md) (documented in [docs/backend](../../docs/backend/README.md)). `VITE_API_URL` picks where it runs:

- `local` (the default): the whole server runs inside the browser, with Postgres as PGlite saved in IndexedDB (one database per network; one tab opens it and the others send it their requests). Every call is still a real HTTP `Request` through the same Hono app, sign-in and all, so the client behaves exactly as it will in production. Clear the site's data to start over.
- A URL such as `https://api.hyperempire.xyz`: calls that deployed server. Nothing else in the client changes.

`src/shared/api.ts` is the only place that knows the difference.

**Admin dashboard:** `http://localhost:5173/admin.html` shows every table, its schema and rows, $aura totals, and a read-only SQL box. Put `ADMIN_USER` and `ADMIN_PASSWORD` (12+ characters) in `.env.local` and restart the dev server; sign in with them. It works next to the game tab. Details in [docs/backend](../../docs/backend/README.md#admin-dashboard).

## What's here

The code is split into `src/trading/` (Hyperliquid trading) and `src/game/` (game and general UI), plus a small `src/shared/`. A test keeps trading safe from game changes. [src/README.md](src/README.md) has the rules.

| Path | What |
| --- | --- |
| `src/trading/index.ts` | Trading's public API: the only file outside `trading/` may import from it |
| `src/trading/TradingTerminal.tsx` | The terminal: market header and account tabs, order book, order form, each behind its own error boundary |
| `src/trading/config.ts` | Builder address and fee, $aura rate, slippage, agent name |
| `src/trading/lib/hl.ts` | Hyperliquid `InfoClient` / `ExchangeClient` ([@nktkas/hyperliquid](https://www.npmjs.com/package/@nktkas/hyperliquid)) |
| `src/trading/lib/agent.ts` | Local trading agent key |
| `src/trading/lib/orders.ts` | Place (market/limit, TP/SL), close, cancel, leverage, all with the builder code |
| `src/trading/lib/prices.ts`, `rewards.ts`, `orderMath.ts` | Perp price/size rounding, fee → $aura, TP/SL, liquidation and slippage estimates |
| `src/trading/lib/referral.ts` | Captures `?ref=CODE` for creator referrals |
| `src/trading/hooks/` | Markets, account data, order book, fees, onboarding (builder fee + agent) |
| `src/trading/components/` | Market header with the dropdown and 24h chart, order book, order panel, positions / orders / fills |
| `src/game/` | Header, scene (ambient life, time of day, hero), buildings (Townhall, Exchange frame), hooks that read and change game state through the API |
| `src/shared/` | Network choice, API client (`api.ts`, local or remote) and wallet sign-in (`session.ts`), storage, display formatting, wallet config, building modal, error boundary, base styles |
| `src/architecture.test.ts` | Fails when an import or a stylesheet crosses the trading / game line, or crosses into or out of the server |

## Known limits (next steps)

- **$aura credited from fills is an estimate** from each fill's `builderFee` (the API credits it on `/me`). A fill routed through another builder also has a `builderFee`, so the real amount comes from the fee indexer, which only counts HyperEmpire's builder fills.
- **No Mine screen yet.** The API already has the full mining flow (`/mine`: recruit, merge, feed, deploy, picks, block rewards); the UI is next.
- **Referral codes** are captured, but not yet sent anywhere. Attribution and USDC fee share need the backend.
- **Hero level fee discount** isn't applied yet: it needs the HeroNFT contract to read the level.
- No depth chart, book price grouping or WebSocket streaming yet. The book polls every 1 s, other data every 3–5 s.
