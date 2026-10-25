# HyperEmpire web app

Phase 1 trading frontend. Users trade Hyperliquid perps through HyperEmpire's builder code, and every fill shows the $aura it earned (500 $aura per $1 of builder fee).

## Run

Vite 8 needs Node 20.19+ (or 22.12+). With the Node on this machine (20.18), run it through Bun:

```bash
bun install
bun --bun run dev        # http://localhost:5173
bun --bun run build
bun test                 # price/size rounding and $aura math
bun run typecheck
```

Copy `.env.example` to `.env.local` and set `VITE_BUILDER_ADDRESS`. Until it is set, markets load but trading is disabled.

**Testnet / Mainnet:** the header toggle switches networks; switching to mainnet asks first. `VITE_HL_NETWORK` is only the default. The choice is saved in the browser (`hyperempire.network`) and the page reloads, because the API client, trading keys and Townhall progress are all per network. Both networks use the same builder wallet (`VITE_BUILDER_ADDRESS`). The builder approval and the trading key are separate on each network, so players go through the one-time setup again the first time they trade on mainnet, and the builder needs its 100 USDC on each network it's used on.

## Screens

- **Empire scene** (`/`): the town from `design/scene/townhall-pixellab.png` (copied to `public/empire/town.png`). Buildings are hotspots; the **Exchange** opens trading, the others show what's coming.
- **Ambient life** (`components/Ambient.tsx`): three cut-out trees sway from the trunk, wind streaks drift across, and every 7–13 s a gust bends the trees harder and blows 6–10 pixel leaves over the town. The scene image is `public/empire/town-base.png` (the PixelLab town with those trees painted out). All motion stops under `prefers-reduced-motion`.
- **Hero** (`components/Hero.tsx`): knight #5 starts on the plaza in front of the Townhall door. **WASD or the arrow keys** walk it around the town in 8 directions at 42 scene px/s, snapped to the scene's pixel grid, drawn at 0.8×. It can only walk on the roads: `public/empire/walkable.png` (from `design/scene/walkable.py`) marks the plaza, the path between the pools and the dirt roads, the feet (5px wide) must stay on it, and a blocked diagonal slides along the road edge. Keys are ignored while a building screen is open or a text field has focus. Sheets in `public/empire/heroes/knight5/` are 4 frames × 8 directions of 32×32: `walk.png` (PixelLab skeleton walk, 0.56s loop) and `idle.png` (head, torso and sword dip 1px, 1.6s loop), over an 8×2 pixel shadow (`heroes/shadow.png`). The hero sits above the hotspots so hover highlights never hide it, lets clicks through, and takes a per-phase filter in place of the time-of-day washes.
- **Time of day** (`hooks/useDayPhase.ts`, `components/TimeOfDay.tsx`): follows the player's local clock. Morning (05:00–11:59) adds a soft-light golden grade (keeps pixel contrast), a sun glow, slow diagonal sunbeams, drifting motes, and warm sun glints twinkling on both pools; evening (12:00–18:59) is the scene as painted; night (19:00–04:59) tints the town dark blue and turns on `public/empire/night-lights.png` (lit windows, doorways, clock, lanterns), flickering lamp glows, fireflies, moonlight from the top-right and a silver moonpath of glints on the pools. The header chip shows the phase; clicking it cycles Auto → Morning → Evening → Night to preview (saved in the browser).
- **Townhall modal** (`/#townhall`): level, $aura progress, risky upgrade (pay 10–100% of the cost for that chance), the three-branch perk tree (Trader live; Fighter and Crafter bank points for Phases 2–3), respec and building caps. Rules live in `src/lib/empire.ts`. Until the Townhall contract ships, progress is saved in the browser per wallet (`useTownhall`), and the $aura balance is 5,000 starter + estimated $aura from fills − Townhall spending. Perk icons in `public/empire/icons/` were generated with PixelLab (Pixflux, scene palette).
- **Exchange modal** (`/#exchange`, also the header's EXCHANGE link): the trading UI, nearly full screen (up to 1800×980), in three columns. On the left are the market header and account tabs; the market name is a dropdown with search, and Enter picks the first match. In the middle is the **order book**, and on the right the order form. `#exchange` deep-links straight in for players who only trade; Escape or ✕ closes it.
- **Order book** (`components/OrderBook.tsx`): 12 asks above the spread and 12 bids below, with price, size and cumulative total in coin or USD over depth bars. It polls `l2Book` every second. Clicking a row switches the order form to Limit at that price.
- **Order form** (`components/OrderPanel.tsx`, math in `lib/orderMath.ts`): laid out like Hyperliquid's (without its Pro order types).
  - **Margin mode and leverage:** CROSS / ISOLATED and leverage buttons open small dialogs that apply the change on Hyperliquid right away (`updateLeverage`).
  - **Order:** Market or Limit (with a MID button and GTC / IOC / ALO time in force), and Buy / Long or Sell / Short.
  - **Size:** in USD or coin, with a 0–100% slider of the max trade size.
  - **Options:** reduce only, and TP/SL set by price or by gain/loss on margin, the two kept in sync.
  - **Summary:** estimated liquidation price, order value, margin required, slippage (estimated from the live book, against the 3% max), the account's own taker and maker fees plus the builder fee, and the $aura earned.
  - **Dev preview:** on the dev server, `/?order-preview#exchange` shows the form without a wallet (zero-address account, nothing can be sent).

The theme in `src/styles.css` uses colours sampled from the Empire scene (slate, wood, parchment, gold, teal, grass, roof red), so the modal matches the town.

## How trading works

1. **Connect** an injected wallet (MetaMask, Rabby…).
2. **Approve builder fee** (one signature): `approveBuilderFee` for `VITE_BUILDER_MAX_FEE_RATE` (0.1%, the perps cap), so the fee can rise later without asking again.
3. **Enable trading** (one signature): a trading key is generated in the browser (`localStorage`) and approved with `approveAgent`. Browser wallets can't sign Hyperliquid L1 actions directly, so the agent signs orders. An agent can trade but never withdraw.
4. **Trade**: every order, close and TP/SL carries `builder: { b: VITE_BUILDER_ADDRESS, f: VITE_BUILDER_FEE_TENTHS_BPS }` (50 = 0.05% at launch).

Both approvals are signatures, not transactions, so they cost no gas. The account needs USDC on Hyperliquid first. The builder address must hold at least 100 USDC in its perps account before Hyperliquid accepts it.

## What's here

| Path | What |
| --- | --- |
| `src/config.ts` | Env config: network, builder address and fee, $aura rate, slippage |
| `src/lib/hl.ts` | Hyperliquid `InfoClient` / `ExchangeClient` ([@nktkas/hyperliquid](https://www.npmjs.com/package/@nktkas/hyperliquid)) |
| `src/lib/agent.ts` | Local trading agent key |
| `src/lib/orders.ts` | Place (market/limit, TP/SL), close, cancel, leverage, all with the builder code |
| `src/lib/format.ts` | Perp price/size rounding, $aura math, display formatting |
| `src/lib/referral.ts` | Captures `?ref=CODE` for creator referrals |
| `src/hooks/` | Markets, account data, onboarding (builder fee + agent) |
| `src/components/` | Header, market header with the market dropdown + 24h chart, order book, order panel, positions / orders / fills |

## Known limits (next steps)

- **$aura shown is an estimate** from each fill's `builderFee`. A fill routed through another builder also has a `builderFee`, so the real amount comes from the fee indexer, which only counts HyperEmpire's builder fills.
- **Referral codes** are captured, but not yet sent anywhere. Attribution and USDC fee share need the backend.
- **Hero level fee discount** isn't applied yet: it needs the HeroNFT contract to read the level.
- No depth chart, book price grouping or WebSocket streaming yet. The book polls every 1 s, other data every 3–5 s.
