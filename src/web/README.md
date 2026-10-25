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

## Screens

- **Empire scene** (`/`): the town from `design/scene/townhall-pixellab.png` (copied to `public/empire/town.png`). Buildings are hotspots; the **Exchange** opens trading, the others show what's coming.
- **Townhall modal** (`/#townhall`): level, $aura progress, risky upgrade (pay 10–100% of the cost for that chance), the three-branch perk tree (Trader live; Fighter and Crafter bank points for Phases 2–3), respec and building caps. Rules live in `src/lib/empire.ts`. Until the Townhall contract ships, progress is saved in the browser per wallet (`useTownhall`), and the $aura balance is 5,000 starter + estimated $aura from fills − Townhall spending. Perk icons in `public/empire/icons/` were generated with PixelLab (Pixflux, scene palette).
- **Exchange modal** (`/#exchange`, also the header's EXCHANGE link): the trading UI. `#exchange` deep-links straight in for players who only trade; Escape or ✕ closes it.

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
| `src/components/` | Header, market list, market header + 24h chart, order panel, positions / orders / fills |

## Known limits (next steps)

- **$aura shown is an estimate** from each fill's `builderFee`. A fill routed through another builder also has a `builderFee`, so the real amount comes from the fee indexer, which only counts HyperEmpire's builder fills.
- **Referral codes** are captured, but not yet sent anywhere. Attribution and USDC fee share need the backend.
- **Hero level fee discount** isn't applied yet: it needs the HeroNFT contract to read the level.
- No order book, depth chart or WebSocket streaming yet. Data polls every 3–5 s.
