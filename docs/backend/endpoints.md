# HyperEmpire API — endpoints

Every endpoint of the HyperEmpire API, with the shapes it takes and returns. The TypeScript types are in [`src/server/src/contract.ts`](../../src/server/src/contract.ts); how things work underneath is in [the backend overview](README.md).

## Conventions

- **Base URL:** the deployed server (`VITE_API_URL`). In development the web app calls the same paths in-process.
- **Bodies:** JSON, with `Content-Type: application/json`. A `POST` without a body sends none.
- **Auth:** every endpoint except `/health` and `/auth/*` needs `Authorization: Bearer <token>` from [sign-in](#sign-in). Without it the answer is `401 unauthorized`.
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
| POST | [`/me/sync`](#post-mesync) | Credit new trading fees now |
| GET | [`/townhall`](#get-townhall) | Townhall state |
| POST | [`/townhall/upgrade`](#post-townhallupgrade) | Try to level up |
| POST | [`/townhall/perks`](#post-townhallperks) | Add a perk rank |
| POST | [`/townhall/respec`](#post-townhallrespec) | Reset all perks |
| GET | [`/mine`](#get-mine) | Pools, Miners, Picks, rush wins |
| POST | [`/mine/recruit`](#post-minerecruit) | Recruit a Miner |
| POST | [`/mine/miners/merge`](#post-mineminersmerge) | Merge two Miners |
| POST | [`/mine/miners/:id/feed`](#post-mineminersidfeed) | Feed a Miner |
| POST | [`/mine/miners/:id/deploy`](#post-mineminersiddeploy) | Send a Miner to a pool, or home |
| POST | [`/mine/miners/:id/equip`](#post-mineminersidequip) | Give a Miner a Pick, or take it off |
| POST | [`/mine/craft`](#post-minecraft) | Craft a Pick |
| POST | [`/mine/picks/merge`](#post-minepicksmerge) | Merge two Picks |
| POST | [`/mine/picks/:id/repair`](#post-minepicksidrepair) | Repair a Pick |

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

Settles finished mining blocks and credits new trading fees (at most every 30 s), then returns:

```json
{ "address": "0x7099…79c8", "aura": 5265, "level": 1, "slots": 3, "synced": 265 }
```

| Field | What |
| --- | --- |
| `aura` | Current balance |
| `level` | Townhall level |
| `slots` | Miners that can be deployed at once: 3 + Foreman ranks |
| `synced` | $aura credited from fees by this call (0 if nothing new, or if it synced recently) |

### `POST /me/sync`

Reads new fills now, ignoring the 30 s limit.

```json
{ "credited": 250 }
```

## Townhall

All Townhall endpoints return a **Townhall view**:

```json
{ "level": 2, "ranks": { "foreman": 1 }, "respecs": 0, "aura": 2234, "nextCost": 5800, "points": 1, "respecCost": 5500 }
```

| Field | What |
| --- | --- |
| `ranks` | Perk id → rank. Perk ids are in `PERKS` (`src/server/src/rules/empire.ts`) |
| `nextCost` | Full cost of the next level |
| `points` | Perk points not spent yet (one per level) |
| `respecCost` | What a respec costs now |

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

### `POST /townhall/perks`

```json
{ "perkId": "foreman" }
```

Adds one rank and returns the Townhall view.

- `400`: unknown perk.
- `409 no_points`: no perk points left.
- `409 max_rank`: already at its top rank.
- `409 tier_locked`: not enough points in that branch for this tier (tier 2 needs 5, tier 3 needs 15).

### `POST /townhall/respec`

No body. Clears every rank, burns `respecCost`, and returns the Townhall view.

- `402 not_enough_aura`.
- `409 nothing_to_reset`: no ranks to clear.

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
