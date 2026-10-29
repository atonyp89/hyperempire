# HyperEmpire API — endpoints

Every endpoint of the HyperEmpire API, with the shapes it takes and returns. The TypeScript types are in [`src/server/src/contract.ts`](../../src/server/src/contract.ts); how things work underneath is in [the backend overview](README.md).

## Conventions

- **Base URL:** the deployed server (`VITE_API_URL`). In development the web app calls the same paths in-process.
- **Bodies:** JSON, with `Content-Type: application/json`. A `POST` without a body sends none.
- **Auth:** every endpoint except `/health`, `/auth/*` and `/admin/*` needs `Authorization: Bearer <token>` from [sign-in](#sign-in). Without it the answer is `401 unauthorized`. `/admin/*` needs the [admin login](#admin) instead.
- **Amounts:** in $aura, as numbers. They can have up to 3 decimals: mining pays fractions.
- **Addresses:** sent in any case, returned lowercase.
- **Errors:** `{ "error": "<code>", "message": "<text>" }` with the status. The common ones are in [the overview](README.md#errors); each endpoint below lists the rule errors it can return.
- **One network per server:** a server, or the in-browser server, serves one Hyperliquid network. `GET /health` says which.

| Method | Path | What |
| --- | --- | --- |
| GET | [`/health`](#get-health) | Is it up, and which network |
| POST | [`/auth/nonce`](#post-authnonce) | Get a message to sign |
| POST | [`/auth/verify`](#post-authverify) | Trade the signature for a session token |
| POST | [`/auth/sign-out`](#post-authsign-out) | End the session |
| GET | [`/me`](#get-me) | Balance, level, Miner slots |
| POST | [`/me/sync`](#post-mesync) | Read new fills now |
| GET | [`/gold`](#get-gold) | $gold balance, and the faucet's size |
| POST | [`/gold/faucet`](#post-goldfaucet) | Claim $gold for testing (local and testnet only) |
| GET | [`/garden`](#get-garden) | The 16 plots, what grows in them, the harvest |
| POST | [`/garden/buy`](#post-gardenbuy) | Buy seeds with $gold |
| POST | [`/garden/plant`](#post-gardenplant) | Plant seeds from the inventory |
| POST | [`/garden/harvest`](#post-gardenharvest) | Harvest ripe plants |
| GET | [`/exchange`](#get-exchange) | Today's $aura pool, your share, recent days |
| GET | [`/mastery/:building`](#get-masterybuilding) | A building's Mastery: level, XP, points, perks |
| POST | [`/mastery/:building/perks`](#post-masterybuildingperks) | Add a perk rank |
| POST | [`/mastery/:building/respec`](#post-masterybuildingrespec) | Reset that building's perks |
| POST | [`/exchange/orders`](#post-exchangeorders) | Report orders placed through our Exchange |
| GET | [`/townhall`](#get-townhall) | Townhall state |
| POST | [`/townhall/upgrade`](#post-townhallupgrade) | Try to level up |
| GET | [`/mine`](#get-mine) | Pools, Miners, Picks, rush wins |
| POST | [`/mine/recruit`](#post-minerecruit) | Recruit a Miner |
| POST | [`/mine/miners/merge`](#post-mineminersmerge) | Merge two Miners |
| POST | [`/mine/miners/:id/feed`](#post-mineminersidfeed) | Feed a Miner |
| POST | [`/mine/miners/:id/deploy`](#post-mineminersiddeploy) | Send a Miner to a pool, or home |
| POST | [`/mine/miners/:id/equip`](#post-mineminersidequip) | Give a Miner a Pick, or take it off |
| POST | [`/mine/craft`](#post-minecraft) | Craft a Pick |
| POST | [`/mine/picks/merge`](#post-minepicksmerge) | Merge two Picks |
| POST | [`/mine/picks/:id/repair`](#post-minepicksidrepair) | Repair a Pick |
| GET | [`/admin/overview`](#get-adminoverview) | Admin: tables, row counts, $aura totals |
| GET | [`/admin/tables/:name`](#get-admintablesname) | Admin: a page of a table's rows |
| POST | [`/admin/query`](#post-adminquery) | Admin: run one read-only SQL statement |

## Health

### `GET /health`

```json
{ "ok": true, "network": "testnet" }
```

## Sign-in

### `POST /auth/nonce`

```json
// request
{ "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }
// response
{
  "nonce": "693dc96be7ae0c354bd86ce199055c05",
  "message": "HyperEmpire wants you to sign in with your wallet.\n\nAddress: 0x7099…79c8\nNetwork: testnet\nNonce: 693dc96be7ae0c354bd86ce199055c05"
}
```

Sign `message` exactly as returned, with `personal_sign`. The nonce works once, for 10 minutes. `400` if the address isn't valid.

### `POST /auth/verify`

```json
// request
{ "address": "0x7099…79C8", "nonce": "693dc96b…", "signature": "0x…" }
// response
{ "token": "9c1e…", "address": "0x7099…79c8", "expiresAt": 1798765432000 }
```

`expiresAt` is in ms, 30 days out. The first sign-in creates the account with 5,000 $aura.

- `400 bad_request`: no signature.
- `401 unauthorized`: the nonce expired or was used, or the signature isn't from this address.

### `POST /auth/sign-out`

Send the token in `Authorization`. Ends that session. Always returns `{ "ok": true }`.

## Player

### `GET /me`

Settles finished mining blocks, reads new fills (at most every 30 s) and settles finished Exchange days, then returns:

```json
{ "address": "0x7099…79c8", "aura": 105000, "gold": 2000, "level": 1, "slots": 3, "pendingAura": 25000 }
```

| Field | What |
| --- | --- |
| `aura` | Current balance |
| `gold` | Current $gold, in whole $gold |
| `level` | Townhall level |
| `slots` | Miners that can be deployed at once: 3 (Mine Mastery will add more) |
| `pendingAura` | Exchange $aura not settled yet: today's estimated share, plus finished days still waiting (on mainnet, for Hyperliquid's file) |

### `POST /me/sync`

Reads new fills now, ignoring the 30 s limit, then settles finished days. Returns how many new builder fees it recorded.

```json
{ "fills": 2 }
```

## $gold

$gold is the in-game currency: earned by playing, never transferred or cashed out. Balances are whole $gold, kept next to $aura in `accounts.gold`; its ledger rows have `currency = 'gold'`.

### `GET /gold`

```json
{ "gold": 2000, "faucet": 1000 }
```

`faucet` is how much one claim gives, or `null` where there is no faucet.

### `POST /gold/faucet`

Adds `faucet` $gold (ledger kind `faucet`) and returns the same shape as `GET /gold`. For testing only: the in-browser server always has it (1,000 per claim), a server only on testnet with `GOLD_FAUCET` set. Elsewhere it answers `404 not_found`. No cooldown.


## Garden

A 4x4 field (`slot` 0–15, row by row). Seeds are inventory items (`wheat-seed`) bought with $gold; planting uses one per plot; a plant grows through its stages on the clock and can be harvested once ripe, into the player's `inventory`. Crops are in `rules/garden.ts` (`CROPS`); each has 3 stages (sprout, young, ripe). Wheat: 10 $gold a seed, ripe in 3 minutes, 3 per plant. Grapes: 25 $gold a seed, ripe in 6 minutes, 4 per vine (test values). Seed items are `<crop>-seed`. The in-browser dev server grows crops 10× faster (`Deps.gameSpeed`), so wheat ripens in 18 s there; `speed` in the view says which.

### `GET /garden`

```json
{
  "now": 1793243000000,
  "speed": 1,
  "plots": [{ "slot": 0, "crop": "wheat", "plantedAt": 1793242900000, "readyAt": 1793243080000, "stage": 1, "ripe": false }, { "slot": 1, "crop": null, "plantedAt": null, "readyAt": null, "stage": 0, "ripe": false }],
  "inventory": { "wheat-seed": 4, "wheat": 9 },
  "gold": 1830
}
```

`plots` always has 16 entries. `stage` runs from 0 (seed) to the crop's last stage (ripe), evenly spaced over its growing time. `now` is the server's clock, so the client can count down without polling.

### `POST /garden/buy`

Body: `{ "crop": "wheat", "qty": 10 }` (1–99, default 1). Takes the seeds' $gold (ledger kind `garden:seed`), adds `wheat-seed` to the inventory and returns the `GET /garden` view. `402 not_enough_gold` if they cost more than the balance.

### `POST /garden/plant`

Body: `{ "crop": "wheat", "slot": 3 }` or `{ "crop": "wheat", "slots": [3, 4, 5] }`. Uses one `wheat-seed` from the inventory per plot and returns the new `GET /garden` view. All or nothing: `409 plot_taken` if any plot is in use, `409 not_enough_items` if there are fewer seeds than plots, `400` for an unknown crop or bad slots.

### `POST /garden/harvest`

Body: `{ "slot": 3 }` or `{ "slots": [3, 4] }`. Every named plot must be ripe (`409 not_ripe`) and planted (`409 plot_empty`). Empties them and adds their crops to the inventory:

```json
{ "harvested": { "wheat": 6 }, "garden": { "…": "the GET /garden view" } }
```

## Exchange

How rewards work: [the backend overview](README.md#exchange-rewards).

### `GET /exchange`

```json
{
  "day": "20261027",
  "endsAt": 1793145600000,
  "feeTenthsBps": 48,
  "emission": 100000,
  "source": "fills",
  "totalFees": 0.4,
  "yourFees": 0.1,
  "totalWeight": 0.42,
  "yourWeight": 0.103,
  "yourEstimate": 24524,
  "pendingAura": 25000,
  "history": [
    { "day": "20261026", "emission": 100000, "totalFees": 2.5, "players": 4, "source": "fills", "yourFees": 0.5, "yourAura": 20000 }
  ]
}
```

| Field | What |
| --- | --- |
| `day`, `endsAt` | Today (UTC, `YYYYMMDD`) and when its pool closes (ms) |
| `emission` | $aura shared out per day |
| `source` | `file` on mainnet (Hyperliquid's builder file decides), `fills` on testnet |
| `feeTenthsBps` | The builder fee to put on your orders, after your Exchange Mastery discount (Hyperliquid's unit: 50 = 0.05%) |
| `totalFees`, `yourFees` | Builder fees seen so far today (USD). On mainnet the final total comes from the file and can be higher |
| `totalWeight`, `yourWeight` | Pool weights so far today: counted fees with Exchange Mastery perks. Shares are split by weight |
| `yourEstimate` | Your share if the day ended now: pool × your weight ÷ total weight |
| `pendingAura` | Today's estimate plus finished days not settled yet |
| `history` | The last 14 settled days, with your fees and $aura |

The extra $aura a new fee `f` (at the list rate) would add today is about `emission × (yourWeight + f) ÷ (totalWeight + f) − yourEstimate`; `marginalShare` in the contract computes it.

### `POST /exchange/orders`

```json
// request: order ids Hyperliquid returned (resting or filled, and TP/SL from open orders)
{ "oids": [123456789, 123456790] }
// response: how many were new
{ "tracked": 2 }
```

Called by the Exchange right after each order or close. It also rereads the last minute of fills, in case an order filled before it was reported.

- `400`: not 1–50 positive integer ids.

## Mastery

Only `exchange` is live; other buildings answer `404` until their Mastery ships. How it works: [the backend overview](README.md#mastery).

### `GET /mastery/:building`

```json
{
  "building": "exchange",
  "level": 3,
  "uncappedLevel": 5,
  "cap": 3,
  "xp": 3200,
  "xpIntoLevel": 200,
  "xpForNext": 2500,
  "xpBonus": 0.03,
  "points": 1,
  "ranks": { "lower-fees": 2 },
  "respecCost": 5750,
  "feeDiscount": 0.04,
  "feeTenthsBps": 48
}
```

| Field | What |
| --- | --- |
| `level`, `uncappedLevel`, `cap` | The level that counts (capped by the Townhall), what the XP alone gives, and the cap |
| `xp`, `xpIntoLevel`, `xpForNext` | Total XP, XP into the uncapped level, and what that level needs (100 × level²) |
| `xpBonus` | Extra XP from the Townhall (+1% per level) |
| `points` | Points not spent yet (one per level) |
| `ranks` | Perk id → rank. Exchange perks: `lower-fees`, `market-maker`, `taker`, `whale` (`EXCHANGE_PERKS` in the contract) |
| `respecCost` | What a respec costs now ($aura) |
| `feeDiscount`, `feeTenthsBps` | Exchange only: your discount and the fee to put on orders |

### `POST /mastery/:building/perks`

```json
{ "perkId": "lower-fees" }
```

Adds one rank and returns the Mastery view.

- `400`: unknown perk.
- `409 no_points`: no points left (earn XP, and raise the Townhall if Mastery is at its cap).
- `409 max_rank`: already at its top rank.

### `POST /mastery/:building/respec`

No body. Clears that building's perks, burns `respecCost`, and returns the Mastery view.

- `402 not_enough_aura`.
- `409 nothing_to_reset`: no perks to reset.

## Townhall

All Townhall endpoints return a **Townhall view**:

```json
{
  "level": 2,
  "aura": 1969,
  "nextCost": 5800,
  "masteryCap": 2,
  "masteryXpBonus": 0.02
}
```

| Field | What |
| --- | --- |
| `nextCost` | Full cost of the next level |
| `masteryCap` | Highest level any building's Mastery can reach: the Townhall level |
| `masteryXpBonus` | Extra Mastery XP in every building, as a fraction (+1% per level) |

Each building's own Mastery is read from [`/mastery/:building`](#get-masterybuilding), shown in that building.

### `GET /townhall`

The Townhall view.

### `POST /townhall/upgrade`

```json
// request: chance in % — 10, 20, … 100
{ "chance": 50 }
// response
{ "ok": false, "spent": 1516, "chance": 50, "townhall": { "level": 1, "aura": 3484, "...": "…" } }
```

Burns `chance`% of `nextCost` (rounded), then rolls. `ok: true` means the level went up.

- `400`: a chance that isn't 10–100 in steps of 10.
- `402 not_enough_aura`.

## Mine

Every Mine endpoint first settles finished blocks. Most return the **Mine view**:

```json
{
  "height": 38160,
  "aura": 4012.5,
  "slots": 4,
  "used": 1,
  "pools": [
    {
      "id": "aura:shared", "reward": "$aura", "kind": "shared", "perBlock": 50,
      "totalPower": 2010, "yourPower": 10,
      "perThousandPowerPerDay": 23920.3, "yourPerDay": 358.2, "yourChancePerBlock": null
    },
    {
      "id": "aura:rush", "reward": "$aura", "kind": "rush", "perBlock": 50,
      "totalPower": 2000, "yourPower": 0,
      "perThousandPowerPerDay": 24000, "yourPerDay": 0, "yourChancePerBlock": 0
    }
  ],
  "miners": [
    { "id": 7, "grade": "common", "energy": 92.4, "pool": "aura:shared", "walkingBlocks": 0, "pickId": null, "power": 10, "feedCost": 2 }
  ],
  "picks": [
    { "id": 3, "grade": "uncommon", "durability": 100, "minerId": null, "repairCost": 0 }
  ],
  "rushWins": [{ "height": 38150, "pool": "aura:rush", "amount": 50 }]
}
```

| Field | What |
| --- | --- |
| `height` | The current block |
| `slots`, `used` | Miner slots, and how many Miners are deployed |
| `pools[].id` | `<reward>:<kind>`, e.g. `aura:shared`. Use it to deploy |
| `pools[].perBlock` | This pool's prize per block |
| `pools[].totalPower` | Power mining here now, including simulated players in development |
| `pools[].perThousandPowerPerDay` | What 1,000 more power would earn here per day at today's total |
| `pools[].yourPerDay` | Your expected earnings per day here (the average, for rush) |
| `pools[].yourChancePerBlock` | Rush pools: your chance to win each block (0–1). `null` for shared |
| `miners[].grade`, `picks[].grade` | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `miners[].walkingBlocks` | Blocks until it reaches its pool and starts mining |
| `miners[].power` | Its power, with its Pick |
| `miners[].feedCost` | $aura to fill it back to 100 energy |
| `picks[].minerId` | The Miner holding it, or `null` |
| `picks[].repairCost` | $aura to repair it to 100 |
| `rushWins` | Your latest rush wins (up to 20) |

### `GET /mine`

The Mine view.

### `POST /mine/recruit`

No body. Burns 1,000 $aura and rolls a grade (70% Common … 0.1% Legendary).

```json
{ "miner": { "id": 8, "grade": "uncommon" }, "mine": { "...": "Mine view" } }
```

- `402 not_enough_aura`.

### `POST /mine/miners/merge`

```json
// request
{ "a": 7, "b": 8 }
// response
{ "ok": true, "miner": { "id": 9, "grade": "uncommon" }, "mine": { "...": "Mine view" } }
```

Both Miners are used up either way. On success (50% for Common down to 15% for Epic) a Miner of the next grade appears; on failure `miner` is absent and `ok` is `false`. Their Picks are taken off first and kept.

- `400`: the same id twice.
- `404`: not your Miner.
- `409 grade_mismatch`: different grades.
- `409 deployed`: one of them is in the Mine. Bring it home first.
- `409 max_grade`: Legendary.

### `POST /mine/miners/:id/feed`

No body. Fills energy to 100 for `feedCost`. Returns the Mine view.

- `402 not_enough_aura`.
- `404`: not your Miner.
- `409 full`: not hungry.

### `POST /mine/miners/:id/deploy`

```json
{ "pool": "aura:rush" }   // or { "pool": null } to bring it home
```

Moving to a pool (or between pools) means 3 blocks of walking before it mines there. Deploying to its current pool does nothing. Returns the Mine view.

- `400`: unknown pool.
- `404`: not your Miner.
- `409 no_slots`: all slots in use (only when sending a Miner that was home).

### `POST /mine/miners/:id/equip`

```json
{ "pickId": 3 }   // or { "pickId": null } to take it off
```

A Pick held by another of your Miners moves to this one. Returns the Mine view.

- `404`: not your Miner or Pick.

### `POST /mine/craft`

No body. Burns 600 $aura and rolls a Pick grade with the same odds as recruiting.

```json
{ "pick": { "id": 4, "grade": "common" }, "mine": { "...": "Mine view" } }
```

- `402 not_enough_aura`.

### `POST /mine/picks/merge`

Like merging Miners, with Picks:

```json
// request
{ "a": 3, "b": 4 }
// response
{ "ok": false, "mine": { "...": "Mine view" } }
```

- `400`: the same id twice.
- `404`: not your Pick.
- `409 grade_mismatch`: different grades.
- `409 equipped`: a Miner holds one of them. Take it off first.
- `409 max_grade`: Legendary.

### `POST /mine/picks/:id/repair`

No body. Restores durability to 100 for `repairCost`. Returns the Mine view.

- `402 not_enough_aura`.
- `404`: not your Pick.
- `409 full`: doesn't need repair.

## Admin

Read-only routes for the [admin dashboard](README.md#admin-dashboard). Every one needs `Authorization: Basic <base64 of user:password>` with the server's `ADMIN_USER` and `ADMIN_PASSWORD`.

- `404 not_found`: the admin login isn't configured (or its password is under 12 characters).
- `401 admin_unauthorized`: wrong username or password.
- `429 too_many_attempts`: 10 wrong logins from this client; wait 15 minutes.

### `GET /admin/overview`

```json
{
  "network": "testnet",
  "tables": [
    {
      "name": "accounts",
      "rows": 1,
      "columns": [{ "name": "address", "type": "text", "nullable": false, "default": null }],
      "indexes": ["CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (address)"]
    }
  ],
  "auraSupply": 2233.507,
  "ledgerByKind": [
    { "kind": "starter", "total": 5000, "entries": 1 },
    { "kind": "fee", "total": 264.507, "entries": 70 },
    { "kind": "townhall:upgrade", "total": -3031, "entries": 1 }
  ],
  "settledHeight": 37709
}
```

Totals are in $aura. `ledgerByKind` is sorted from most minted to most burned. `settledHeight` is `null` before the first block settles.

### `GET /admin/tables/:name`

Query: `limit` (1–500, default 50), `offset` (default 0), `order` (a column; defaults to the first), `dir` (`asc` or `desc`, default `desc`).

```json
{ "table": "miners", "columns": ["id", "address", "grade", "..."], "rows": [{ "id": 1, "address": "0x…", "grade": 0 }], "total": 3, "limit": 50, "offset": 0 }
```

Rows are raw, as stored (amounts in milli-$aura). An unknown `order` falls back to the first column.

- `404`: no such table.

### `POST /admin/query`

```json
// request
{ "sql": "SELECT kind, count(*) FROM ledger GROUP BY kind" }
// response
{ "columns": ["kind", "count"], "rows": [{ "kind": "fee", "count": 70 }], "rowCount": 3, "truncated": false, "ms": 4 }
```

One statement, starting with `SELECT`, `WITH`, `EXPLAIN`, `SHOW`, `TABLE` or `VALUES`. It runs in a read-only transaction that is rolled back. At most 500 rows come back; `truncated` says there were more.

- `400 query_failed`: not a read, more than one statement, a write Postgres refused, or a SQL error (the message is Postgres's).

## Example: a full session with curl

```bash
API=http://localhost:8787
curl -s -X POST $API/auth/nonce -H 'content-type: application/json' -d '{"address":"0xYourAddress"}'
# sign the returned message with the wallet, then:
curl -s -X POST $API/auth/verify -H 'content-type: application/json' -d '{"address":"0xYourAddress","nonce":"…","signature":"0x…"}'
TOKEN=…
curl -s $API/me -H "authorization: Bearer $TOKEN"
curl -s -X POST $API/mine/recruit -H "authorization: Bearer $TOKEN"
curl -s -X POST $API/mine/miners/1/deploy -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"pool":"aura:shared"}'
```

## Changing the API

1. Add or change the route in `src/server/src/routes/`, and its types in `contract.ts`.
2. Add a test to `src/server/src/app.test.ts`.
3. Update this page.
4. For a change in the database, add a new migration to `src/db/migrations.ts`. Never edit an applied one.
5. Old clients keep running until they reload, so prefer adding fields to renaming or removing them.
